var page = require('webpage').create();
var system = require('system');
var fs = require('fs');

var url = system.args[1];
var viewportWidth = system.args[3];
var viewportHeight = system.args[4];

page.onConsoleMessage = function (msg) {
	console.log('console: ' + msg);
};

page.viewportSize = {
	width: viewportWidth,
	height: viewportHeight
};

page.open(url, function () {
	var hitElements = {success: "true"};
	if (page.injectJs("lib/jquery.min.js")) {
		var tmpCssFile = fs.open(system.args[2], 'r');
		var selectors = tmpCssFile.read().split("||");
		tmpCssFile.close();
		hitElements["hits"] = page.evaluate(function (selectors, viewportWidth, viewportHeight) {
			function arrayHasElement(element, array) {
				for (var i = 0; i < array.length; i++) {
					if (array[i] === element) {
						return true;
					}
				}
				return false;
			}

			var results = [];
			for (var i = 0; i < selectors.length; i++) {
				var originalSelector = selectors[i];
				var selector = selectors[i];
				if(selector.indexOf("@") === 0){
					continue;
				}
				if(selector.indexOf(":") != -1){
					var splitSelectors = selector.split(",");
					var pseudoCleanSelectors = "";
					for(var j=0;j<splitSelectors.length;j++){
						var removedPseudoFromSelector = splitSelectors[j].substring(0, splitSelectors[j].indexOf(":"));
						if(removedPseudoFromSelector.length>0 && removedPseudoFromSelector!==" "){
							pseudoCleanSelectors += removedPseudoFromSelector + ",";
						}
					}

					selector = pseudoCleanSelectors.substring(0, pseudoCleanSelectors.length-1);
				}
				try {
					var elements = $(selector);
				}
				catch(e){
					//console.log("OPA: " + originalSelector + " \n" + selector);
					continue;
				}
				for (var j = 0; j < elements.length; j++) {
					var element = elements[j];
					if (element !== undefined && element.getBoundingClientRect() !== undefined && element.getBoundingClientRect().top < viewportHeight && element.getBoundingClientRect().left < viewportWidth) {
						if (!arrayHasElement(selector, results)) {
							results.push(originalSelector);
						}
					}
				}
			}
			return results;
		}, selectors, viewportWidth, viewportHeight);
	}
	else {
		hitElements["success"] = false;
		hitElements["errorMessage"] = "PhantomJS: Local jQuery failed to load";
	}
	fs.write(system.args[2], JSON.stringify(hitElements), 'w');
	console.log(hitElements["success"]);
	phantom.exit();
});

