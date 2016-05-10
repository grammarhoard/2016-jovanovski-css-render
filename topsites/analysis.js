var fs = require('fs'),
    jsdom = require("jsdom"),
    mkdirp = require('mkdirp'),
    path = require('path'),
    exec = require('child_process').exec,
    getDirName = require('path').dirname,
    request = require('request'),
    wptUrl = "52.9.202.97",
    key = "33f6b472561edfcf6130b2a65b687104f9ed5d62",
    cooldown = 5000,
    siteBase = "http://gorjan.rocks/research/thesis/topsites/"
    ;

function generateTests(start, limit) {
    fs.readFile("alexa.csv", 'utf8', function (err, data) {
        if (!err) {
            var lines = data.split(/\r?\n/);
            var i = 0;
            for (var n = start; n < limit; n++) {
                i++;
                var site = lines[n].split(",")[1];

                if (site.indexOf("http:") !== 0) {
                    site = "http://" + site + "/";
                }


                if (site !== "") {
                    setTimeout(saveHTML, i * cooldown, site, n);
                }
            }
        }
        else {
            console.log("Alexa file can not be opened");
        }
    });
}

function saveHTML(site, id) {
    console.log("Requesting HTML for: " + site + " (" + id + ")");
    (function (site, id) {
        request(site, function (error, response, data) {
            if (!error && response.statusCode == 200) {
                jsdom.env({
                    html: data,
                    done: function (error, window) {
                        if (error) {
                            console.log("A jsdom error occurred: " + error);
                        }
                        else {
                            var head = window.document.head || window.document.getElementsByTagName('head')[0];
                            var base = window.document.createElement('base');
                            base.href = site;
                            head.insertBefore(base, head.firstChild);

                            var html = window.document.documentElement.outerHTML;
                            var baseDir = "../topsites/testSites/" + id + "/";
                            var original = "original.html";

                            (function (baseDir, original, id) {
                                mkdirp(getDirName(baseDir + original), function (error) {
                                    if (error) {
                                        console.log("Error writing file " + baseDir + original);
                                    }
                                    else {
                                        fs.writeFileSync(baseDir + original, html, {flag: 'w'});
                                        console.log("Saved " + id + "");
                                        //exec("node ../node/focusr.js " + baseDir + " " + original + " " + "focused.html",
                                        //    function (error, stdout) {
                                        //        console.log("Focusr done (" + id + ")");
                                        //        processUrl(siteBase + "testSites/"+id+"/" + "original.html", id);
                                        //        processUrl(siteBase + "testSites/"+id+"/" + "focused.html", id);
                                        //    });
                                    }
                                });
                            })(baseDir, original, id);


                        }
                    }
                });

            }
            else {
                console.log(" Error fetching remote site '" + site + "': " + error);
            }
        });
    })(site, id);

}


function processUrl(site, id) {
	console.log("doing: " + site + " (" + id + ")");
	var url = "http://"+wptUrl+"/runtest.php?url=" + encodeURIComponent(site) + "&k=" + key + "&f=json&location=EC2-WPT_wptdriver:Chrome.Cable";

	(function(url, id){
		request(url, function (error, response, jsonData) {
			if (!error && response.statusCode == 200) {
				jsonData = JSON.parse(jsonData);
				if (jsonData["statusCode"] === 200) {
                    console.log(jsonData["data"]["jsonUrl"]);
					fs.appendFile('analysisID.txt', jsonData["data"]["jsonUrl"] + " | "+id+"\n");
				}
				else {
					console.log(JSON.stringify(jsonData));
				}
			}
			else {
				console.log(" Error fetching remote site '" + "'");
			}
		});
	})(url, id);

}


//----------------------------------
//generateTests(800, 1000);
//----------------------------------

//function generateTests(start, limit) {
//	fs.readFile("alexa.csv", 'utf8', function (err, data) {
//		if (!err) {
//			var lines = data.split(/\r?\n/);
//			var cooldown = 0;
//			for (var n = start; n < limit; n++) {
//				cooldown++;
//				var site = lines[n].split(",")[1];
//				if (site !== "") {
//					setTimeout(processUrl, cooldown * 500, site);
//				}
//			}
//		}
//		else {
//			console.log("Alexa file can not be opened");
//		}
//	});
//}
//function getTest(testUrl) {
//	console.log("trying: " + testUrl);
//	request(testUrl, function (error, response, jsonData) {
//		if (!error && response.statusCode == 200) {
//			try {
//				jsonData = JSON.parse(jsonData);
//				if (jsonData["statusText"] === "Test Complete") {
//					var height = "";
//					console.log("done " + jsonData["data"]["url"]);
//					if (jsonData["data"]["median"] !== undefined && jsonData["data"]["median"]["firstView"] !== undefined && jsonData["data"]["median"]["firstView"]["document-height"] !== undefined) {
//						height = jsonData["data"]["median"]["firstView"]["document-height"];
//					}
//					fs.appendFile('testResults2.txt', jsonData["data"]["url"] + "," + jsonData["data"]["runs"]["1"]["firstView"]["render"] + "," + height + "\n");
//
//				}
//				else {
//					console.log("Incomplete test!!");
//				}
//			}
//			catch (ex) {
//				console.log("op ex");
//			}
//		}
//		else {
//			console.log(" Error fetching remote site " + JSON.stringify(response));
//		}
//	});
//}
//function getTestResults(start) {
//	fs.readFile("testIDs1.txt", 'utf8', function (err, data) {
//		if (!err) {
//			var lines = data.split(/\r?\n/);
//			var cooldown = 0;
//			for (var n = start * 2; n < lines.length; n++) {
//				cooldown++;
//				var split = lines[n].split(",");
//				var testUrl = split[0];
//				if (testUrl === "") {
//					continue;
//				}
//				setTimeout(getTest, cooldown * 2000, testUrl);
//
//			}
//		}
//		else {
//			console.log("Tests file can not be opened");
//		}
//	});
//}
//function calculateTimes() {
//	var timesArr = [];
//	var avgArr = [];
//	var min = 1000000000000000;
//	var max = 0;
//	var resolutions = [0, 0, 0, 0];
//	var times = [0, 0, 0, 0, 0];
//	var skipped = 0;
//	var processed = 0;
//	fs.readFile("testResults2.txt", 'utf8', function (err, data) {
//			if (!err) {
//				var lines = data.split(/\r?\n/);
//				for (var n = 0; n < lines.length; n++) {
//					var split = lines[n].split(",");
//					var site = split[0];
//					var time = split[1];
//					var res = split[2];
//
//					if (res !== "") {
//						if (res < 800) {
//							resolutions[0]++;
//						}
//						else if (res < 1000) {
//							resolutions[1]++;
//						}
//						else if (res < 1100) {
//							resolutions[2]++;
//						}
//						else {
//							resolutions[3]++;
//						}
//					}
//
//					if (timesArr[site] !== undefined) {
//						var diff = Math.abs(timesArr[site] - time);
//						if (diff < 5) {
//							skipped++;
//							continue;
//						}
//						processed++;
//						avgArr.push(diff);
//						if (diff < 500) {
//							times[0]++;
//						}
//						else if (diff < 1000) {
//							times[1]++;
//						}
//						else if (diff < 1500) {
//							times[2]++;
//						}
//						else if (diff < 2000) {
//							times[3]++;
//						}
//						else {
//							times[4]++;
//						}
//
//						if (diff < min) {
//							min = diff;
//						}
//						if (diff > max) {
//							max = diff;
//						}
//					}
//					else {
//						timesArr[site] = time;
//					}
//				}
//				var sum = 0;
//				for (var i = 0; i < avgArr.length; i++) {
//					sum += avgArr[i];
//				}
//
//
//				var ressum = 0;
//				for (var i = 0; i < resolutions.length; i++) {
//					ressum += resolutions[i];
//				}
//
//				var timesum = 0;
//				for (var i = 0; i < times.length; i++) {
//					timesum += times[i];
//				}
//
//				console.log("-----------");
//				console.log("Total sites: 1000");
//				console.log("Processed sites: " + (1000 - skipped));
//				console.log("Skipped sites: " + skipped);
//				console.log("-----------");
//				console.log("Loading time difference:");
//				console.log("< 500ms: " + (times[0] / (timesum / 100)).toFixed(2) + "%");
//				console.log("< 1000ms: " + (times[1] / (timesum / 100)).toFixed(2) + "%");
//				console.log("< 1500ms: " + (times[2] / (timesum / 100)).toFixed(2) + "%");
//				console.log("< 2000ms: " + (times[3] / (timesum / 100)).toFixed(2) + "%");
//				console.log("> 2000ms: " + (times[4] / (timesum / 100)).toFixed(2) + "%");
//				console.log("----");
//				console.log("Maximum time saved " + max.toFixed(2) + "ms");
//				console.log("Minimum time saved " + min.toFixed(2) + "ms");
//				console.log("Total average saved: " + (sum / avgArr.length).toFixed(2) + "ms");
//				console.log("-----------");
//				console.log("Screen resolutions:");
//				console.log("< 800px: " + (resolutions[0] / (ressum / 100)).toFixed(2) + "%");
//				console.log("< 1000px: " + (resolutions[1] / (ressum / 100)).toFixed(2) + "%");
//				console.log("< 1100px: " + (resolutions[2] / (ressum / 100)).toFixed(2) + "%");
//				console.log("> 1100px: " + (resolutions[3] / (ressum / 100)).toFixed(2) + "%");
//				console.log("-----------");
//			}
//			else {
//				console.log("Tests file can not be opened");
//			}
//		}
//	);
//}

//generateTests(900, 1000);
//getTestResults(900);
//calculateTimes();