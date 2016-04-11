var page = require('webpage').create(), system = require('system');

var url = system.args[1];
var selectors = system.args[2].split("||");
var viewportWidth = system.args[3];
var viewportHeight = system.args[4];

page.onConsoleMessage = function(msg) {
	console.log('console: ' + msg);
};

page.onResourceRequested = function(requestData, request) {
	if (requestData.url.endsWith(".js")) {
		console.log('Disabling JavaScript files. Aborting: ' + requestData['url']);
		request.abort();
	}
};

page.open(url, function () {
	var hitElements = {success: "true"};
	if (page.injectJs("jquery.min.js")) {
		hitElements["hits"] = page.evaluate(function (selectors, viewportWidth, viewportHeight) {
			var results = [];
			for (var i = 0; i < selectors.length; i++) {
				var element = $(selectors[i]);
				if (element !== undefined && element.offset() !== undefined && element.offset().top < viewportHeight && element.offset().left < viewportWidth) {
					results.push({"selector": selectors[i], "top": element.offset().top, "left": element.offset().left});
				}
			}
			return results;
		}, selectors, viewportWidth, viewportHeight);
	}
	else {
		hitElements["success"] = false;
		hitElements["errorMessage"] = "PhantomJS: Local jQuery failed to load";
	}
	console.log(JSON.stringify(hitElements));
	phantom.exit();
});