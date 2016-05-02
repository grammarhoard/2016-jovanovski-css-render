var critical = require('critical');
critical.generate({
	inline: true,
	base: 'tests/test3/',
	src: 'pre.html',
	dest: 'index-critical.html',
	width: 1200,
	height: 900,
	minify: true,
	ignore: ["lazyLoaded"]
});