var critical = require('critical');
critical.generate({
	inline: true,
	src: 'http://thenextweb.com/facebook/2016/04/17/facebook-activates-safety-check-wake-earthquake-ecuador/',
	dest: 'index-critical.html',
	width: 1200,
	height: 900,
	minify: true,
	ignore: ["lazyLoaded"]
});