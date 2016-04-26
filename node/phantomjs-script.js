var page = require('webpage').create(),
	system = require('system'),
	fs = require('fs'),
	htmlUrl = system.args[1],
	viewportWidth = system.args[3],
	viewportHeight = system.args[4];

page.onConsoleMessage = function (msg) {
	console.log('console: ' + msg);
};

page.viewportSize = {
	width: viewportWidth,
	height: viewportHeight
};

page.open(htmlUrl, function () {
	var hitElements = {success: "true"};
	if (page.injectJs("lib/jquery.min.js")) {
		var tmpCssFile = fs.open(system.args[2], 'r');
		var cssAst = JSON.parse(tmpCssFile.read());
		tmpCssFile.close();
		hitElements["hits"] = page.evaluate(function (cssAst, viewportWidth, viewportHeight) {
			for (var i = 0; i < cssAst["stylesheet"]["rules"].length; i++) {
				var rule = cssAst["stylesheet"]["rules"][i];
				if (!rule["critical"]) {
					if (rule["type"] === "rule") {
						var ruleHit = false;
						for (var j = 0; j < rule["selectors"].length; j++) {
							var selector = rule["selectors"][j];
							// Nasty fix for @-ms-viewport
							if (selector.indexOf("@") === 0) {
								continue;
							}

							// Clean off pseudo stuff
							if (selector.indexOf(":") != -1) {
								selector = selector.substring(0, selector.indexOf(":"));
							}

							var elements;
							try {
								elements = $(selector);
							}
							catch (e) {
								//console.log("OPA: " + originalSelector + " \n" + selector);
								continue;
							}
							var hit = false;
							for (var k = 0; k < elements.length; k++) {
								var element = elements[k];
								if (element !== undefined && element.getBoundingClientRect() !== undefined && element.getBoundingClientRect().top < viewportHeight && element.getBoundingClientRect().left < viewportWidth) {
									hit = true;
									break;
								}
							}
							if (hit) {
								ruleHit = true;
								break;
							}
						}
						rule["critical"] = ruleHit;
					}
					else if (rule["type"] === "font-face") {
						//TODO NO!
						rule["critical"] = true;
					}
				}
			}

			//-----------
			//for (var i = 0; i < selectors.length; i++) {
			//	var originalSelector = selectors[i];
			//	var selector = selectors[i];
			//	if (selector.indexOf("@") === 0) {
			//		continue;
			//	}
			//	if (selector.indexOf(":") != -1) {
			//		var splitSelectors = selector.split(",");
			//		var pseudoCleanSelectors = "";
			//		for (var j = 0; j < splitSelectors.length; j++) {
			//			var removedPseudoFromSelector = splitSelectors[j].substring(0, splitSelectors[j].indexOf(":"));
			//			if (removedPseudoFromSelector.length > 0 && removedPseudoFromSelector !== " ") {
			//				pseudoCleanSelectors += removedPseudoFromSelector + ",";
			//			}
			//		}
			//
			//		selector = pseudoCleanSelectors.substring(0, pseudoCleanSelectors.length - 1);
			//	}
			//	try {
			//		var elements = $(selector);
			//	}
			//	catch (e) {
			//		//console.log("OPA: " + originalSelector + " \n" + selector);
			//		continue;
			//	}
			//	for (var j = 0; j < elements.length; j++) {
			//		var element = elements[j];
			//		if (element !== undefined && element.getBoundingClientRect() !== undefined && element.getBoundingClientRect().top < viewportHeight && element.getBoundingClientRect().left < viewportWidth) {
			//			if (!arrayHasElement(selector, results)) {
			//				results.push(originalSelector);
			//			}
			//		}
			//	}
			//}

			return cssAst;
		}, cssAst, viewportWidth, viewportHeight);
	}
	else {
		hitElements["success"] = false;
		hitElements["errorMessage"] = "PhantomJS: Local jQuery failed to load";
	}
	fs.write(system.args[2], JSON.stringify(hitElements["hits"]), 'w');
	console.log(hitElements["success"]);
	phantom.exit();
});

