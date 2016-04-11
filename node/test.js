var fs = require('fs');
var css = require('css');
var path = require('path');
var CleanCSS = require('clean-css');
var jsdom = require("jsdom");
var childProcess = require('child_process');
var phantomjs = require('phantomjs-prebuilt');
var binPath = phantomjs.path;
var jquery = fs.readFileSync("jquery.min.js", "utf-8");

function parseConfig(json) {
	for (var i = 0; i < json["groups"].length; i++) {
		var fileObject = json["groups"][i];
		parseFile(fileObject);
	}
}

function parseFile(fileObject) {
	for (var i = 0; i < fileObject["css"].length; i++) {
		var cssFile = fileObject["css"][i];
		fileObject["html"] = fs.readFileSync(fileObject["inputFile"], "utf-8");
		fileObject["runs"] = 0;
		readCss(cssFile, fileObject);
	}
}

function readCss(cssFile, fileObject) {
	console.log("Reading '" + cssFile + "' for '" + fileObject["inputFile"] + "'");
	fs.readFile(cssFile, 'utf8', function (error, cssData) {
		if (!error) {
			createAST(cssData, cssFile, fileObject);
		}
		else {
			console.log(cssFile + " file can not be opened");
			return undefined;
		}
	});
}

function createAST(cssData, cssFile, fileObject) {
	if (cssData !== undefined) {
		fileObject["runs"]++;
		var cssAst = css.parse(cssData, {source: cssFile});
		var selectorMap = getCssSelectors(cssAst);
		checkIfSelectorsHit(selectorMap, fileObject, cssFile, cssAst);
	}
}

function getCssSelectors(cssAst) {
	//noinspection JSUnresolvedFunction
	var selectorMap = new Map();
	for (var i = 0; i < cssAst.stylesheet.rules.length; i++) {
		var rule = cssAst["stylesheet"]["rules"][i];
		if (rule["type"] === "rule") {
			selectorMap.set(rule["selectors"].join(', '), rule["declarations"]);
		}
	}
	return selectorMap;
}

function checkIfSelectorsHit(selectorMap, fileObject, cssFile, cssAst) {

	var tmpFile = fileObject["outputFile"] + "-tmp.html";
	var viewportW = fileObject["viewport"][0];
	var viewportH = fileObject["viewport"][1];
	var selectors = [];
	var mapIterator = selectorMap.keys();
	var currentKey = mapIterator.next();
	while (!currentKey["done"]) {
		selectors.push(currentKey["value"]);
		currentKey = mapIterator.next()
	}

	jsdom.env({
		html: html,
		done: function (error, window) {
			if (error) {
				console.log("A jsdom error occurred: " + error);
			}
			else {
				var scripts = window.document.getElementsByTagName("script");
				for (var i = 0; i < scripts.length; i++) {
					scripts[i].parentNode.removeChild(scripts[i]);
				}
				fs.writeFileSync(tmpFile, window.document.documentElement.outerHTML, {flag: 'w'},
					function () {
						console.log("Error writing file '" + fileObject["outputFile"] + "'.tmp: ");
					});

				console.log("Calling PhantomJS with " + selectors.length + " selectors");
				var childArgs = [
					path.join(__dirname, 'phantomjs-script.js'),
					tmpFile,
					selectors.join("||"),
					viewportW,
					viewportH
				];

				childProcess.execFile(binPath, childArgs, function (err, stdout, stderr) {
					if (!err) {
						try {
							var json = JSON.parse(stdout.replace(/(\r\n|\n|\r)/gm, ""));
							if (json["success"]) {
								console.log("PhantomJS reported that " + json["hits"].length + " selectors hit");
								sliceCss(json["hits"], selectorMap, fileObject, cssFile, cssAst);
							}
							else {
								console.log("A controlled exception occurred: " + json["errorMessage"]);
							}
						}
						catch (ex) {
							console.dir("Unexpected output from PhantomJS: " + stdout + " " + stderr + " " + ex);
						}
					}
					else {
						console.log("A PhantomJS error occurred: " + stderr);
					}
				});
			}
		}
	});


}

function sliceCss(selectorHits, selectorMap, fileObject, cssFile, cssAst) {
	var criticalCss = "";
	for (var i = 0; i < selectorHits.length; i++) {
		if (selectorMap.has(selectorHits[i]["selector"])) {
			criticalCss += selectorHits[i]["selector"] + "{";
			var declarations = selectorMap.get(selectorHits[i]["selector"]);
			for (var j = 0; j < declarations.length; j++) {
				if (declarations[j]["type"] === "declaration") {
					criticalCss += declarations[j]["property"] + ":" + declarations[j]["value"] + ";";
				}
			}
			criticalCss += "}";
		}
	}

	var minifiedCriticalCss = new CleanCSS().minify(criticalCss).styles;

	injectInlineCss(minifiedCriticalCss, fileObject, cssFile, cssAst);
}

function injectInlineCss(minifiedCriticalCss, fileObject, cssFile) {

	jsdom.env({
		html: fileObject["html"],
		done: function (error, window) {
			if (error) {
				console.log("A jsdom error occurred: " + error);
			}
			else {
				var head = window.document.head || window.document.getElementsByTagName('head')[0];
				var style = window.document.createElement('style');

				style.type = 'text/css';
				if (style.styleSheet) {
					style.styleSheet.cssText = minifiedCriticalCss;
				} else {
					style.appendChild(window.document.createTextNode(minifiedCriticalCss));
				}
				head.appendChild(style);

				if (fileObject["debug"]) {
					var body = window.document.body || window.document.getElementsByTagName('body')[0];
					body.innerHTML = "<div style='border: 3px solid red; width: " + fileObject["viewport"][0] + "px; height:" + fileObject["viewport"][1] + "; position:absolute; top:0; left:0;, z-index: 2147483647'></div>" + body.innerHTML;
				}

				console.log("fixing " + cssFile);
				var cssLinkPath = path.posix.relative(fileObject["inputFile"], cssFile).substring(3);
				var linkElement = window.document.querySelectorAll('link[href="' + cssLinkPath + '"]')[0];
				if (linkElement !== undefined) {
					head.removeChild(linkElement);
				}

				fileObject["html"] = window.document.documentElement.outerHTML;


				fileObject["runs"]--;
				if (fileObject["runs"] == 0) {
					fs.writeFileSync(fileObject["outputFile"], fileObject["html"], {flag: 'w'},
						function () {
							console.log("Error writing file '" + fileObject["outputFile"] + "': ");
						});
				}
			}
		}
	});
}

//---------------------------------------------------------------------

fs.readFile("config.json", 'utf8', function (err, data) {
	if (!err) {
		parseConfig(JSON.parse(data));
	}
	else {
		console.log("Config file can not be opened");
	}
});
