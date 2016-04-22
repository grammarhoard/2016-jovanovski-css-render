var page = require('webpage').create(),
	system = require('system'),
	htmlUrl = system.args[1],
	imageName = system.args[2],
	width = system.args[3],
	height = system.args[4];

page.viewportSize = {
	width: width,
	height: height
};
page.open(htmlUrl, function() {
	console.log(htmlUrl + " screenshot generated");
	page.evaluate(function(w, h) {
		document.body.bgColor = 'white';
		document.body.style.width = w + "px";
		document.body.style.height = h + "px";
	}, width, height);
	page.clipRect = {top: 0, left: 0, width: width, height: height};
	page.render(imageName);
	phantom.exit();
});