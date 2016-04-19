var fs = require('fs'),
	path = require('path'),
	request = require('request'),
//	key = "d75bab0b8bf048418e97d46b6dc9f3a6"
	key = "A.c62d0fd4a991b6fb36b2ab6b7b217723"
//key = "A.3feb7c69c6658aef2dc4e49d891264d2"
	;
function generateTests(start, limit) {
	fs.readFile("alexa.csv", 'utf8', function (err, data) {
		if (!err) {
			var lines = data.split(/\r?\n/);
			for (var n = start; n < limit; n++) {
				var site = lines[n].split(",")[1];
				if (site !== "") {
					var blockUrl = "http://www.webpagetest.org/runtest.php?url=" + site + "&k=" + key + "&f=json&web10=1&fvonly=1&block=.css&noimages=1&noopt=1&noheaders=1";
					var url = "http://www.webpagetest.org/runtest.php?url=" + site + "&k=" + key + "&f=json&web10=1&fvonly=1&noimages=1&noopt=1&noheaders=1&custom=%5Bdocument-height%5D%0Areturn%20Math.max(window.document.body.scrollHeight%2C%20window.document.body.offsetHeight%2C%20window.document.documentElement.clientHeight%2C%20window.document.documentElement.scrollHeight%2C%20window.document.documentElement.offsetHeight)%3B";
					request(blockUrl, function (error, response, jsonData) {
						if (!error && response.statusCode == 200) {
							jsonData = JSON.parse(jsonData);
							if (jsonData["statusCode"] === 200) {
								fs.appendFile('testIDs.txt', jsonData["data"]["jsonUrl"] + ",true\n");
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
								fs.appendFile('testIDs.txt', jsonData["data"]["jsonUrl"] + ",false\n");
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
			}
		}
		else {
			console.log("Alexa file can not be opened");
		}
	});
}

function getTestResults() {
	fs.readFile("testIDs.txt", 'utf8', function (err, data) {
		if (!err) {
			var lines = data.split(/\r?\n/);
			for (var n = 0; n < lines.length; n++) {
				var split = lines[n].split(",");
				var testUrl = split[0];
				if (testUrl === "") {
					continue;
				}
				request(testUrl, function (error, response, jsonData) {
					if (!error && response.statusCode == 200) {
						jsonData = JSON.parse(jsonData);
						if (jsonData["statusText"] === "Test Complete") {
							var height = "";
							if (jsonData["data"]["median"] !== undefined && jsonData["data"]["median"]["firstView"] !== undefined && jsonData["data"]["median"]["firstView"]["document-height"] !== undefined) {
								height = jsonData["data"]["median"]["firstView"]["document-height"];
							}
							try {
								fs.appendFile('testResults.txt', jsonData["data"]["url"] + "," + jsonData["data"]["runs"]["1"]["firstView"]["render"] + "," + height + "\n");
							}
							catch (ex){}
						}
					}
					else {
						console.log(" Error fetching remote site '" + "'" + response.statusText);
					}
				});
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
	var resolutions = [0, 0, 0, 0, 0];
	fs.readFile("testResults.txt", 'utf8', function (err, data) {
		if (!err) {
			var lines = data.split(/\r?\n/);
			for (var n = 0; n < lines.length; n++) {
				var split = lines[n].split(",");
				var site = split[0];
				var time = split[1];
				var res = split[2];

				if(res !== "") {
					if (res < 768) {
						resolutions[0]++;
					}
					else if (res < 800) {
						resolutions[1]++;
					}
					else if (res < 900) {
						resolutions[2]++;
					}
					else if (res < 1080) {
						resolutions[3]++;
					}
					else {
						resolutions[4]++;
					}
				}

				if (timesArr[site] !== undefined) {
					var diff = Math.abs(timesArr[site] - time);
					if (diff < 10) {
						continue;
					}
					avgArr.push(diff);
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

			console.log("Total average " + sum / avgArr.length + "ms");
			console.log("Max " + max + "ms");
			console.log("Min " + min + "ms");
			console.log(resolutions.join());
			console.log("<768: " + resolutions[0] / (ressum / 100));
			console.log("<800: " + resolutions[1] / (ressum / 100));
			console.log("<900: " + resolutions[2] / (ressum / 100));
			console.log("<1080: " + resolutions[3] / (ressum / 100));
			console.log(">=1080: " + resolutions[4] / (ressum / 100));
		}
		else {
			console.log("Tests file can not be opened");
		}
	});
}
//Stopped at this
//generateTests(0, 95);
//getTestResults();
calculateTimes();