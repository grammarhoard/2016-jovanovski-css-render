var fs = require('fs'),
	mkdirp = require('mkdirp'),
	getDirName = require('path').dirname,
	css = require('css'),
	path = require('path'),
	CleanCSS = require('clean-css'),
	jsdom = require("jsdom"),
	request = require('request'),
	MediaQuery = require('css-mediaquery'),
	childProcess = require('child_process'),
	phantomjs = require('phantomjs-prebuilt'),
	open = require("open"),
	binPath = phantomjs.path,
	global = {};

function parseConfig(json) {
	console.log("------------------");
	console.log("Focusr run stared\n");

	var id = 1;
	global = json;
	global["runningGroups"] = 0;
	for (var i = 0; i < json["groups"].length; i++) {
		var groupObject = json["groups"][i];
		if (groupObject["enabled"]) {
			groupObject["groupID"] = id++;
			global["runningGroups"]++;
			parseGroup(groupObject);
		}
	}
}

function parseGroup(groupObject) {
	groupObject["html"] = fs.readFileSync(groupObject["baseDir"] + groupObject["inputFile"], "utf-8");
	groupObject["runs"] = 0;
	findCSSInHTML(groupObject);
}

function findCSSInHTML(groupObject) {
	jsdom.env({
		html: groupObject["html"],
		done: function (error, window) {
			if (error) {
				console.log("[" + groupObject["groupID"] + "] A jsdom error occurred: " + error);
			}
			else {
				var stylesheets = window.document.querySelectorAll("link[rel='stylesheet']");
				for (var i = 0; i < stylesheets.length; i++) {
					var cssFile = stylesheets[i].getAttribute("href");
					readCss(cssFile, groupObject);
				}
			}
		}
	});
}

function readCss(cssFile, groupObject) {
	var originalCssFile = cssFile;
	if (isRemoteUrl(cssFile)) {
		request(cssFile, function (error, response, cssData) {
			if (!error && response.statusCode == 200) {
				createAST(cssData.toString(), originalCssFile, groupObject);
			}
			else {
				console.log(groupObject["groupID"] + " Error fetching remote file '" + cssFile + "'");
			}
		});
	}
	else {
		if (isBaseRelative(cssFile)) {
			cssFile = groupObject["baseDir"] + cssFile.substring(1);
		}
		else {
			cssFile = groupObject["baseDir"] + path.dirname(groupObject["inputFile"]).substring(1) + cssFile;
		}

		fs.readFile(cssFile, 'utf8', function (error, cssData) {
			if (!error) {
				createAST(cssData, originalCssFile, groupObject);
			}
			else {
				console.log("[" + groupObject["groupID"] + "] Error fetching local file '" + cssFile + "'");
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

function createAST(cssData, cssFile, groupObject) {
	if (cssData !== undefined) {
		groupObject["runs"]++;
		var cssAst = css.parse(cssData);
		var selectorMap = getCssSelectors(cssAst, groupObject);
		checkIfSelectorsHit(selectorMap, groupObject, cssFile, cssAst);
	}
}

function getCssSelectors(cssAst, groupObject) {
	//noinspection JSUnresolvedFunction
	var selectorMap = new Map();
	for (var i = 0; i < cssAst["stylesheet"]["rules"].length; i++) {
		var rule = cssAst["stylesheet"]["rules"][i];
		addRuleDeclarations(rule, selectorMap, groupObject["viewport"][0], groupObject["viewport"][1], true);
	}
	return selectorMap;
}

function addRuleDeclarations(rule, selectorMap, width, height, matchViewport) {
	if (rule["type"] === "rule") {
		var selector = rule["selectors"].join(', ');
		if (selectorMap.has(selector)) {
			selectorMap.set(selector, selectorMap.get(selector).concat(rule["declarations"]));
		}
		else {
			selectorMap.set(selector, rule["declarations"]);
		}
	}
	else if (rule["type"] === "media" && mediaQueryMatchesViewport(rule["media"], width, height) === matchViewport) {
		for (var j = 0; j < rule["rules"].length; j++) {
			addRuleDeclarations(rule["rules"][j], selectorMap, width, height, matchViewport);
		}
	}
}

//TODO: this screen thing is not good
function mediaQueryMatchesViewport(mediaQuery, width, height) {
	return MediaQuery.match("screen and " + mediaQuery, {
		width: width + 'px',
		height: height + 'px',
		type: 'screen'
	});
}

//ASYNC
function checkIfSelectorsHit(selectorMap, groupObject, cssFile, cssAst) {

	var tmpCssFile = groupObject["baseDir"] + groupObject["outputFile"] + Date.now() + ".txt";
	var viewportW = groupObject["viewport"][0];
	var viewportH = groupObject["viewport"][1];
	var html = groupObject["html"];
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
				console.log("[" + groupObject["groupID"] + "] A jsdom error occurred: " + error);
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
				writeFile(groupObject["baseDir"] + groupObject["outputFile"], window.document.documentElement.outerHTML);


				// Save CSS selectors to tmp file because they may be too big for console argument
				writeFile(tmpCssFile, selectors.join("||"));


				console.log("[" + groupObject["groupID"] + "] Calling PhantomJS with " + selectors.length + " selectors from " + cssFile);

				var childArgs = [
					path.join(__dirname, 'phantomjs-script.js'),
					groupObject["baseDir"] + groupObject["outputFile"],
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
								console.log("[" + groupObject["groupID"] + "] PhantomJS reported that " + json["hits"].length + " selectors hit in " + cssFile);
								sliceCss(json["hits"], selectorMap, groupObject, cssFile, cssAst, tmpCssFile);
							}
							else {
								console.log("[" + groupObject["groupID"] + "] A controlled exception occurred: " + json["errorMessage"] + " " + stdout);
							}
						}
						catch (ex) {
							console.dir("[" + groupObject["groupID"] + "] Unexpected output from PhantomJS: " + stdout + " " + stderr + " " + ex);
						}
					}
					else {
						console.log("[" + groupObject["groupID"] + "] A PhantomJS error occurred: " + err + " " + stdout + " " + stderr);
					}
				});
			}
		}
	});


}

function sliceCss(selectorHits, selectorMap, groupObject, cssFile, cssAst, tmpCssFile) {
	var criticalCss = "";
	var nonCriticalCss = "";

	var mapIterator = selectorMap.keys();
	var currentKey = mapIterator.next();
	while (!currentKey["done"]) {
		var selector = currentKey["value"];
		var declarations = selectorMap.get(selector);
		if (selectorHits.indexOf(selector) != -1) {
			criticalCss += selector + "{";
			for (var j = 0; j < declarations.length; j++) {
				if (declarations[j]["type"] === "declaration") {
					criticalCss += declarations[j]["property"] + ":" + declarations[j]["value"] + ";";
				}
			}
			criticalCss += "}";
		}
		else {
			nonCriticalCss += selector + "{";
			for (var j = 0; j < declarations.length; j++) {
				if (declarations[j]["type"] === "declaration") {
					nonCriticalCss += declarations[j]["property"] + ":" + declarations[j]["value"] + ";";
				}
			}
			nonCriticalCss += "}";
		}
		currentKey = mapIterator.next()
	}

	selectorMap = new Map();
	for (var i = 0; i < cssAst["stylesheet"]["rules"].length; i++) {
		var rule = cssAst["stylesheet"]["rules"][i];
		if (rule["type"] === "media") {
			addRuleDeclarations(rule, selectorMap, groupObject["viewport"][0], groupObject["viewport"][1], false);
		}
	}

	mapIterator = selectorMap.keys();
	currentKey = mapIterator.next();
	while (!currentKey["done"]) {
		selector = currentKey["value"];
		declarations = selectorMap.get(selector);
		nonCriticalCss += selector + "{";
		for (var j = 0; j < declarations.length; j++) {
			if (declarations[j]["type"] === "declaration") {
				nonCriticalCss += declarations[j]["property"] + ":" + declarations[j]["value"] + ";";
			}
		}
		nonCriticalCss += "}";
		currentKey = mapIterator.next()
	}

	//for (var i = 0; i < selectorHits.length; i++) {
	//	if (selectorMap.has(selectorHits[i])) {
	//		criticalCss += selectorHits[i] + "{";
	//		var declarations = selectorMap.get(selectorHits[i]);
	//		for (var j = 0; j < declarations.length; j++) {
	//			if (declarations[j]["type"] === "declaration") {
	//				criticalCss += declarations[j]["property"] + ":" + declarations[j]["value"] + ";";
	//			}
	//		}
	//		criticalCss += "}";
	//	}
	//}

	var minifiedCriticalCss = new CleanCSS().minify(criticalCss).styles;
	var minifiedNonCriticalCss = new CleanCSS().minify(nonCriticalCss).styles;
	injectInlineCss(minifiedCriticalCss, minifiedNonCriticalCss, groupObject, cssFile, cssAst, tmpCssFile);
}

//ASYNC
function injectInlineCss(minifiedCriticalCss, minifiedNonCriticalCss, groupObject, cssFile, cssAst, tmpCssFile) {
	jsdom.env({
		html: groupObject["html"],
		done: function (error, window) {
			if (error) {
				console.log("A jsdom error occurred: " + error);
			}
			else {

				// Insert minified critical css in <style> tag
				var head = window.document.head || window.document.getElementsByTagName('head')[0];
				var body = window.document.body || window.document.getElementsByTagName('body')[0];
				var criticalStyleTag = window.document.createElement('style');
				criticalStyleTag.type = 'text/css';
				if (criticalStyleTag.styleSheet) {
					criticalStyleTag.styleSheet.cssText = minifiedCriticalCss;
				} else {
					criticalStyleTag.appendChild(window.document.createTextNode(minifiedCriticalCss));
				}
				head.appendChild(criticalStyleTag);


				// Try and find <link> tag with CSS to remove it
				var linkElement = window.document.querySelectorAll('link[href="' + cssFile + '"]')[0];
				if (linkElement !== undefined) {
					head.removeChild(linkElement);
				}

				var nonCriticalStyleTag = window.document.createElement('style');
				nonCriticalStyleTag.type = 'text/css';
				if (nonCriticalStyleTag.styleSheet) {
					nonCriticalStyleTag.styleSheet.cssText = minifiedNonCriticalCss;
				} else {
					nonCriticalStyleTag.appendChild(window.document.createTextNode(minifiedNonCriticalCss));
				}
				body.appendChild(nonCriticalStyleTag);

				// Save HTML for possible next CSS file run
				groupObject["html"] = window.document.documentElement.outerHTML;

				// Delete tmp CSS file
				fs.unlink(tmpCssFile);

				groupObject["runs"]--;
				// Check if no more css runs remaining
				if (groupObject["runs"] == 0) {

					// Insert debug viewport box
					if (global["debug"]) {
						body.innerHTML = '<div style="border: 3px solid red; width: ' + groupObject["viewport"][0] + 'px; height:' + groupObject["viewport"][1] + 'px;position:absolute;top:0;left:0;z-index:2147483647"></div>' + body.innerHTML;
						groupObject["html"] = window.document.documentElement.outerHTML;
					}

					global["runningGroups"]--;

					// Delete temp HTML file
					fs.unlink(groupObject["baseDir"] + groupObject["outputFile"]);

					// Save it
					writeFile(groupObject["baseDir"] + groupObject["outputFile"], groupObject["html"]);


					console.log("[" + groupObject["groupID"] + "] File '" + groupObject["baseDir"] + groupObject["outputFile"] + "' generated ");

					if (global["autoOpen"]) {
						open(groupObject["baseDir"] + groupObject["outputFile"]);
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