var fs = require('fs');
var mkdirp = require('mkdirp');
var getDirName = require('path').dirname;
var css = require('css');
var path = require('path');
var CleanCSS = require('clean-css');
var jsdom = require("jsdom");
var request = require('request');
var MediaQuery = require('css-mediaquery');
var childProcess = require('child_process');
var phantomjs = require('phantomjs-prebuilt');
var open = require("open");
var binPath = phantomjs.path;
var jquery = fs.readFileSync("jquery.min.js", "utf-8");
var global = {};

function parseConfig(json) {
	console.log("------------------");
	console.log("Focusr run stared\n");

	var id = 1;
	global = json;
	global["runningGroups"] = 0;
	for (var i = 0; i < json["groups"].length; i++) {
		var fileObject = json["groups"][i];
		if (fileObject["enabled"]) {
			fileObject["groupID"] = id++;
			global["runningGroups"]++;
			parseFile(fileObject);
		}
	}
}

function parseFile(fileObject) {
	fileObject["html"] = fs.readFileSync(fileObject["baseDir"] + fileObject["inputFile"], "utf-8");
	fileObject["runs"] = 0;
	findCSSInHTML(fileObject);
	//for (var i = 0; i < fileObject["css"].length; i++) {
	//	var cssFile = fileObject["css"][i];
	//	fileObject["html"] = fs.readFileSync(fileObject["inputFile"], "utf-8");
	//	findCSSInHTML(fileObject["html"]);
	//	fileObject["runs"] = 0;
	//	//readCss(cssFile, fileObject);
	//}
}

function findCSSInHTML(fileObject) {
	jsdom.env({
		html: fileObject["html"],
		done: function (error, window) {
			if (error) {
				console.log("[" + fileObject["groupID"] + "] A jsdom error occurred: " + error);
			}
			else {
				var stylesheets = window.document.querySelectorAll("link[rel='stylesheet']");
				for (var i = 0; i < stylesheets.length; i++) {
					var cssFile = stylesheets[i].getAttribute("href");
					readCss(cssFile, fileObject);
				}
			}
		}
	});
}

function readCss(cssFile, fileObject) {
	var originalCssFile = cssFile;
	// Remote file
	if (isRemoteUrl(cssFile)) {
		request(cssFile, function (error, response, cssData) {
			if (!error && response.statusCode == 200) {
				createAST(cssData.toString(), originalCssFile, fileObject);
			}
			else {
				console.log(fileObject["groupID"] + " Error fetching remote file '" + cssFile + "'");
			}
		});
	}
	// Local file
	else {
		// Relative to base dir
		if (isBaseRelative(cssFile)) {
			cssFile = fileObject["baseDir"] + cssFile.substring(1);
		}
		// Relative to HTML file
		else {
			cssFile = fileObject["baseDir"] + path.dirname(fileObject["inputFile"]).substring(1) + cssFile;
		}

		fs.readFile(cssFile, 'utf8', function (error, cssData) {
			if (!error) {
				createAST(cssData, originalCssFile, fileObject);
			}
			else {
				console.log("[" + fileObject["groupID"] + "] " + cssFile + " file can not be opened");
			}
		});
	}

}

function isRemoteUrl(url) {
	return url.lastIndexOf("http://", 0) === 0 || url.lastIndexOf("https://", 0) === 0 || url.lastIndexOf("www.", 0) === 0;
}

function isBaseRelative(url) {
	return url.lastIndexOf("/", 0) === 0;
}

function createAST(cssData, cssFile, fileObject) {
	if (cssData !== undefined) {
		fileObject["runs"]++;
		var cssAst = css.parse(cssData);
		var selectorMap = getCssSelectors(cssAst, fileObject);
		checkIfSelectorsHit(selectorMap, fileObject, cssFile, cssAst);
	}
}

function getCssSelectors(cssAst, fileObject) {
	//noinspection JSUnresolvedFunction
	var selectorMap = new Map();
	for (var i = 0; i < cssAst["stylesheet"]["rules"].length; i++) {
		var rule = cssAst["stylesheet"]["rules"][i];
		addRuleDeclarations(rule, selectorMap, fileObject);
	}
	return selectorMap;
}

function addRuleDeclarations(rule, selectorMap, fileObject) {
	if (rule["type"] === "rule") {
		var selector = rule["selectors"].join(', ');
		if (selectorMap.has(selector)) {
			selectorMap.set(selector, selectorMap.get(selector).concat(rule["declarations"]));
		}
		else {
			selectorMap.set(selector, rule["declarations"]);
		}
	}
	else if (rule["type"] === "media" && mediaQueryMatchesViewport(rule["media"], fileObject)) {
		for (var j = 0; j < rule["rules"].length; j++) {
			addRuleDeclarations(rule["rules"][j], selectorMap, fileObject);
		}
	}
}

//TODO: this screen thing is not good
function mediaQueryMatchesViewport(mediaQuery, fileObject) {
	var width = fileObject["viewport"][0];
	var height = fileObject["viewport"][1];
	var hit = MediaQuery.match("screen and " + mediaQuery, {
		width: width + 'px',
		height: height + 'px',
		type: 'screen'
	});
	return hit;
}

//ASYNC
function checkIfSelectorsHit(selectorMap, fileObject, cssFile, cssAst) {

	var tmpCssFile = fileObject["baseDir"] + fileObject["outputFile"] + Date.now() + ".txt";
	var viewportW = fileObject["viewport"][0];
	var viewportH = fileObject["viewport"][1];
	var html = fileObject["html"];
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
				console.log("[" + fileObject["groupID"] + "] A jsdom error occurred: " + error);
			}
			else {
				if (!global["allowJs"]) {
					// Remove all <script> tags for PhantomJS to load faster
					var scripts = window.document.getElementsByTagName("script");
					for (var i = 0; i < scripts.length; i++) {
						scripts[i].parentNode.removeChild(scripts[i]);
					}
				}

				// Save script-stripped HTML to tmp file (since PhantomJS is annoyed by string HTML)
				writeFile(fileObject["baseDir"] + fileObject["outputFile"], window.document.documentElement.outerHTML);


				// Save CSS selectors to tmp file because they may be too big for console argument
				writeFile(tmpCssFile, selectors.join("||"));


				console.log("[" + fileObject["groupID"] + "] Calling PhantomJS with " + selectors.length + " selectors from " + cssFile);

				var childArgs = [
					path.join(__dirname, 'phantomjs-script.js'),
					fileObject["baseDir"] + fileObject["outputFile"],
					tmpCssFile,
					viewportW,
					viewportH
				];

				// Run PhantomJS
				childProcess.execFile(binPath, childArgs, function (err, stdout, stderr) {
					if (!err) {
						try {
							var json = stdout.replace(/(\r\n|\n|\r)/gm, "");
							if (json === "true") {
								json = JSON.parse(fs.readFileSync(tmpCssFile, "utf-8"));
								console.log("[" + fileObject["groupID"] + "] PhantomJS reported that " + json["hits"].length + " selectors hit in " + cssFile);
								sliceCss(json["hits"], selectorMap, fileObject, cssFile, cssAst, tmpCssFile);
							}
							else {
								console.log("[" + fileObject["groupID"] + "] A controlled exception occurred: " + json["errorMessage"] + " " + stdout);
							}
						}
						catch (ex) {
							console.dir("[" + fileObject["groupID"] + "] Unexpected output from PhantomJS: " + stdout + " " + stderr + " " + ex);
						}
					}
					else {
						console.log("[" + fileObject["groupID"] + "] A PhantomJS error occurred: " + err + " " + stdout + " " + stderr);
					}
				});
			}
		}
	});


}

function sliceCss(selectorHits, selectorMap, fileObject, cssFile, cssAst, tmpCssFile) {
	var criticalCss = "";
	for (var i = 0; i < selectorHits.length; i++) {
		if (selectorMap.has(selectorHits[i])) {
			criticalCss += selectorHits[i] + "{";
			var declarations = selectorMap.get(selectorHits[i]);
			for (var j = 0; j < declarations.length; j++) {
				if (declarations[j]["type"] === "declaration") {
					criticalCss += declarations[j]["property"] + ":" + declarations[j]["value"] + ";";
				}
			}
			criticalCss += "}";
		}
	}

	var minifiedCriticalCss = new CleanCSS().minify(criticalCss).styles;
	injectInlineCss(minifiedCriticalCss, fileObject, cssFile, cssAst, tmpCssFile);
}

//ASYNC
function injectInlineCss(minifiedCriticalCss, fileObject, cssFile, cssAst, tmpCssFile) {
	jsdom.env({
		html: fileObject["html"],
		done: function (error, window) {
			if (error) {
				console.log("A jsdom error occurred: " + error);
			}
			else {

				// Insert minified critical css in <style> tag
				var head = window.document.head || window.document.getElementsByTagName('head')[0];
				var style = window.document.createElement('style');
				style.type = 'text/css';
				if (style.styleSheet) {
					style.styleSheet.cssText = minifiedCriticalCss;
				} else {
					style.appendChild(window.document.createTextNode(minifiedCriticalCss));
				}
				head.appendChild(style);



				// Try and find <link> tag with CSS to remove it
				var linkElement = window.document.querySelectorAll('link[href="' + cssFile + '"]')[0];
				if (linkElement !== undefined) {
					head.removeChild(linkElement);
				}

				// Save HTML for possible next CSS file run
				fileObject["html"] = window.document.documentElement.outerHTML;

				// Delete tmp CSS file
				fs.unlink(tmpCssFile);

				fileObject["runs"]--;
				// Check if no more css runs remaining
				if (fileObject["runs"] == 0) {

					// Insert debug viewport box
					if (global["debug"]) {
						var body = window.document.body || window.document.getElementsByTagName('body')[0];
						body.innerHTML = '<div style="border: 3px solid red; width: ' + fileObject["viewport"][0] + 'px; height:' + fileObject["viewport"][1] + 'px;position:absolute;top:0;left:0;z-index:2147483647"></div>' + body.innerHTML;
						fileObject["html"] = window.document.documentElement.outerHTML;
					}

					global["runningGroups"]--;

					// Delete temp HTML file
					fs.unlink(fileObject["baseDir"] + fileObject["outputFile"]);

					// Save it
					writeFile(fileObject["baseDir"] + fileObject["outputFile"], fileObject["html"]);


					console.log("[" + fileObject["groupID"] + "] File '" + fileObject["baseDir"] + fileObject["outputFile"] + "' generated ");

					if (global["autoOpen"]) {
						open(fileObject["baseDir"] + fileObject["outputFile"]);
					}

					// Check if no more groups running
					if (global["runningGroups"] === 0) {
						console.log("\nFocusr run ended");
						console.log("------------------");
					}
				}
			}
		}
	});
}

function writeFile(path, contents) {
	mkdirp(getDirName(path), function (error) {
		if (error) {
			console.log("Error writing file " + path);
		}
		else {
			fs.writeFileSync(path, contents, {flag: 'w'});
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