var fs = require('fs'),
	path = require('path'),
	request = require('request'),
//	key = "d75bab0b8bf048418e97d46b6dc9f3a6" //simon
//	key = "A.c62d0fd4a991b6fb36b2ab6b7b217723" //my second
//	key = "A.3feb7c69c6658aef2dc4e49d891264d2" //my first
	key = "A.8eb992381b7d5eb13485dd6858dab8e5" //my third
	;

function processUrl(site) {
	console.log("doing: " + site);
	var blockUrl = "http://www.webpagetest.org/runtest.php?url=" + site + "&k=" + key + "&f=json&web10=1&fvonly=1&block=.css%20fonts.googleapis.com&noimages=1&noopt=1&noheaders=1";
	var url = "http://www.webpagetest.org/runtest.php?url=" + site + "&k=" + key + "&f=json&web10=1&fvonly=1&noimages=1&noopt=1&noheaders=1&custom=%5Bdocument-height%5D%0Areturn%20Math.max(window.document.body.scrollHeight%2C%20window.document.body.offsetHeight%2C%20window.document.documentElement.clientHeight%2C%20window.document.documentElement.scrollHeight%2C%20window.document.documentElement.offsetHeight)%3B";
	request(blockUrl, function (error, response, jsonData) {
		if (!error && response.statusCode == 200) {
			jsonData = JSON.parse(jsonData);
			if (jsonData["statusCode"] === 200) {
				fs.appendFile('testIDs1.txt', jsonData["data"]["jsonUrl"] + ",true\n");
			}
			else {
				console.log(JSON.stringify(jsonData));
			}
		}
		else {
			console.log(" Error fetching remote site '" + "'");
		}
	});
	request(url, function (error, response, jsonData) {
		if (!error && response.statusCode == 200) {
			jsonData = JSON.parse(jsonData);
			if (jsonData["statusCode"] === 200) {
				fs.appendFile('testIDs1.txt', jsonData["data"]["jsonUrl"] + ",false\n");
			}
			else {
				console.log(JSON.stringify(jsonData));
			}
		}
		else {
			console.log(" Error fetching remote site '" + "'");
		}
	});
}
function generateTests(start, limit) {
	fs.readFile("alexa.csv", 'utf8', function (err, data) {
		if (!err) {
			var lines = data.split(/\r?\n/);
			var cooldown = 0;
			for (var n = start; n < limit; n++) {
				cooldown++;
				var site = lines[n].split(",")[1];
				if (site !== "") {
					setTimeout(processUrl, cooldown * 500, site);
				}
			}
		}
		else {
			console.log("Alexa file can not be opened");
		}
	});
}

function getTest(testUrl) {
	console.log("trying: " + testUrl);
	request(testUrl, function (error, response, jsonData) {
		if (!error && response.statusCode == 200) {
			try {
				jsonData = JSON.parse(jsonData);
				if (jsonData["statusText"] === "Test Complete") {
					var height = "";
					console.log("done " + jsonData["data"]["url"]);
					if (jsonData["data"]["median"] !== undefined && jsonData["data"]["median"]["firstView"] !== undefined && jsonData["data"]["median"]["firstView"]["document-height"] !== undefined) {
						height = jsonData["data"]["median"]["firstView"]["document-height"];
					}
					fs.appendFile('testResults2.txt', jsonData["data"]["url"] + "," + jsonData["data"]["runs"]["1"]["firstView"]["render"] + "," + height + "\n");

				}
				else {
					console.log("Incomplete test!!");
				}
			}
			catch (ex) {
				console.log("op ex");
			}
		}
		else {
			console.log(" Error fetching remote site " + JSON.stringify(response));
		}
	});
}

function getTestResults(start) {
	fs.readFile("testIDs1.txt", 'utf8', function (err, data) {
		if (!err) {
			var lines = data.split(/\r?\n/);
			var cooldown = 0;
			for (var n = start * 2; n < lines.length; n++) {
				cooldown++;
				var split = lines[n].split(",");
				var testUrl = split[0];
				if (testUrl === "") {
					continue;
				}
				setTimeout(getTest, cooldown * 2000, testUrl);

			}
		}
		else {
			console.log("Tests file can not be opened");
		}
	});
}

function calculateTimes() {
	var timesArr = [];
	var avgArr = [];
	var min = 1000000000000000;
	var max = 0;
	var resolutions = [0, 0, 0, 0];
	var times = [0, 0, 0, 0, 0];
	var skipped = 0;
	var processed = 0;
	fs.readFile("testResults2.txt", 'utf8', function (err, data) {
			if (!err) {
				var lines = data.split(/\r?\n/);
				for (var n = 0; n < lines.length; n++) {
					var split = lines[n].split(",");
					var site = split[0];
					var time = split[1];
					var res = split[2];

					if (res !== "") {
						if (res < 800) {
							resolutions[0]++;
						}
						else if (res < 1000) {
							resolutions[1]++;
						}
						else if (res < 1100) {
							resolutions[2]++;
						}
						else {
							resolutions[3]++;
						}
					}

					if (timesArr[site] !== undefined) {
						var diff = Math.abs(timesArr[site] - time);
						if (diff < 5) {
							skipped++;
							continue;
						}
						processed++;
						avgArr.push(diff);
						if (diff < 500) {
							times[0]++;
						}
						else if (diff < 1000) {
							times[1]++;
						}
						else if (diff < 1500) {
							times[2]++;
						}
						else if (diff < 2000) {
							times[3]++;
						}
						else {
							times[4]++;
						}

						if (diff < min) {
							min = diff;
						}
						if (diff > max) {
							max = diff;
						}
					}
					else {
						timesArr[site] = time;
					}
				}
				var sum = 0;
				for (var i = 0; i < avgArr.length; i++) {
					sum += avgArr[i];
				}


				var ressum = 0;
				for (var i = 0; i < resolutions.length; i++) {
					ressum += resolutions[i];
				}

				var timesum = 0;
				for (var i = 0; i < times.length; i++) {
					timesum += times[i];
				}

				console.log("-----------");
				console.log("Total sites: 700");
				console.log("Processed sites: " + (700 - skipped));
				console.log("Skipped sites: " + skipped);
				console.log("-----------");
				console.log("Loading time difference:");
				console.log("< 500ms: " + (times[0] / (timesum / 100)).toFixed(2) + "%");
				console.log("< 1000ms: " + (times[1] / (timesum / 100)).toFixed(2) + "%");
				console.log("< 1500ms: " + (times[2] / (timesum / 100)).toFixed(2) + "%");
				console.log("< 2000ms: " + (times[3] / (timesum / 100)).toFixed(2) + "%");
				console.log("> 2000ms: " + (times[4] / (timesum / 100)).toFixed(2) + "%");
				console.log("----");
				console.log("Maximum time saved " + max.toFixed(2) + "ms");
				console.log("Minimum time saved " + min.toFixed(2) + "ms");
				console.log("Total average saved: " + (sum / avgArr.length).toFixed(2) + "ms");
				console.log("-----------");
				console.log("Screen resolutions:");
				console.log("< 800px: " + (resolutions[0] / (ressum / 100)).toFixed(2) + "%");
				console.log("< 1000px: " + (resolutions[1] / (ressum / 100)).toFixed(2) + "%");
				console.log("< 1100px: " + (resolutions[2] / (ressum / 100)).toFixed(2) + "%");
				console.log("> 1100px: " + (resolutions[3] / (ressum / 100)).toFixed(2) + "%");
				console.log("-----------");
			}
			else {
				console.log("Tests file can not be opened");
			}
		}
	);
}

//generateTests(600, 700);
//getTestResults(0);
calculateTimes();