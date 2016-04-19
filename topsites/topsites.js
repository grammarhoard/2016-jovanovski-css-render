var fs = require('fs'),
	path = require('path'),
	request = require('request');

function generateTests(start, limit) {
	fs.readFile("alexa.csv", 'utf8', function (err, data) {
		if (!err) {
			var lines = data.split(/\r?\n/);
			for (var n = start; n < limit; n++) {
				var site = lines[n].split(",")[1];
				if (site !== "") {
					var blockUrl = "http://www.webpagetest.org/runtest.php?url=" + site + "&k=A.3feb7c69c6658aef2dc4e49d891264d2&f=json&web10=1&fvonly=1&block=.css&noimages=1&noopt=1&noheaders=1";
					var url = "http://www.webpagetest.org/runtest.php?url=" + site + "&k=A.3feb7c69c6658aef2dc4e49d891264d2&f=json&web10=1&fvonly=1&noimages=1&noopt=1&noheaders=1";
					request(blockUrl, function (error, response, jsonData) {
						if (!error && response.statusCode == 200) {
							jsonData = JSON.parse(jsonData);
							if (jsonData["statusCode"] === 200) {
								fs.appendFile('testIDs.txt', jsonData["data"]["jsonUrl"] + ",true\n");
							}
							else{
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
							else{
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
				var site = split[1];
				if(testUrl===""){
					continue;
				}
				request(testUrl, function (error, response, jsonData) {
					if (!error && response.statusCode == 200) {
						jsonData = JSON.parse(jsonData);
						if (jsonData["statusText"] === "Test Complete") {
							fs.appendFile('testResults.txt', jsonData["data"]["url"] + "," + jsonData["data"]["runs"]["1"]["firstView"]["render"] + "\n");
						}
					}
					else {
						console.log(" Error fetching remote site '" + "'");
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
	fs.readFile("testResults.txt", 'utf8', function (err, data) {
		if (!err) {
			var lines = data.split(/\r?\n/);
			for (var n = 0; n < lines.length; n++) {
				var split = lines[n].split(",");
				var site = split[0];
				var time = split[1];
				if (timesArr[site] !== undefined) {
					var diff = Math.abs(timesArr[site] - time);
					if(diff<10){
						continue;
					}
					console.log(site + " - " + diff);
					avgArr.push(diff);
					if(diff < min){
						min = diff;
					}
					if(diff > max){
						max = diff;
					}
				}
				else {
					timesArr[site] = time;
				}
			}
			var sum = 0;
			for( var i = 0; i < avgArr.length; i++ ){
				sum +=  avgArr[i];
			}

			console.log("Total average " + sum/avgArr.length + "ms");
			console.log("Max " + max + "ms");
			console.log("Min " + min + "ms");
		}
		else {
			console.log("Tests file can not be opened");
		}
	});
}
//Stopped at this
//generateTests(120, 150);
//getTestResults();
calculateTimes();