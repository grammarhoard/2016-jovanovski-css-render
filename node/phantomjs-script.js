var page = require('webpage').create(), system = require('system'), fs = require('fs');

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
	if (page.injectJs("jquery.min.js")) {


		var cssFile = fs.open(system.args[2], 'r');
		var selectors = cssFile.read().split("||");
		cssFile.close();
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
				var elements = $(selectors[i]);
				for (var j = 0; j < elements.length; j++) {
					var element = elements[j];
					if (element !== undefined && element.getBoundingClientRect() !== undefined && element.getBoundingClientRect().top < viewportHeight && element.getBoundingClientRect().left < viewportWidth) {
						if (!arrayHasElement(selectors[i], results)) {
							results.push(selectors[i]);
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

