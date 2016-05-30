var fs = require('fs'),
    jsdom = require("jsdom"),
    mkdirp = require('mkdirp'),
    colors = require('colors'),
    path = require('path'),
    exec = require('child_process').exec,
    getDirName = require('path').dirname,
    request = require('request'),

// ------------------
// LOCAL
// ------------------
//  location = "&location=EC2-WPT_wptdriver:Chrome.Cable";
//  wptUrl = "52.9.202.97",
//  key = "33f6b472561edfcf6130b2a65b687104f9ed5d62", //localhost
// ------------------

// ------------------
// LIVE
// ------------------
    location = "",
    wptUrl = "www.webpagetest.org",
//    key = "d75bab0b8bf048418e97d46b6dc9f3a6", //simon
//	key = "A.c62d0fd4a991b6fb36b2ab6b7b217723", //my second
//  key = "A.3feb7c69c6658aef2dc4e49d891264d2", //my first
//	key = "A.8eb992381b7d5eb13485dd6858dab8e5", //my third
    key = "A.4d783fa1687e14da06245ec7554cf6ec", //my fourth
// ------------------

    cooldown = 5000,
    siteBase = "http://gorjan.rocks/research/thesis/topsites/"
    ;

function getHTML(start) {
    fs.readFile("alexa.csv", 'utf8', function (err, data) {
        if (!err) {
            var lines = data.split(/\r?\n/);
            var i = 0;
            for (var n = start; n < 1001; n++) {
                i++;
                var site = lines[n].split(",")[1];

                if (site.indexOf("http:") !== 0) {
                    site = "http://" + site + "/";
                }

                if (site !== "") {
                    setTimeout(saveHTML, i * 7000, site, n);
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
                            //generateTests(id + 1);
                        }
                        else {
                            var head = window.document.head || window.document.getElementsByTagName('head')[0];
                            var bases = head.querySelectorAll("base");
                            for (var i = 0; i < bases.length; i++) {
                                head.removeChild(bases[i]);
                            }

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
                                        //generateTests(id + 1);
                                    }
                                    else {
                                        fs.writeFileSync(baseDir + original, html, {flag: 'w'});
                                        console.log("Saved " + id + "");
                                        if (id < 999) {
                                            //generateTests(id + 1);
                                        }
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
                //generateTests(id + 1);
            }
        });
    })(site, id);

}

function runFocusr(id, limit) {
    if (id == limit) {
        return;
    }
    try {
        fs.accessSync("../topsites/testSites/" + id + "/original.html");

        console.log("Focusr doing (" + id + ")");
        console.time("focusr-" + id);
        exec("node focusr.js " + "../topsites/testSites/" + id + "/" + " " + "original.html" + " " + "focused.html",
            function (error, stdout) {
                if (!error && stdout.indexOf("generated") != -1) {
                    console.log(colors.green("Focusr ✓ (" + id + ")"));
                    console.timeEnd("focusr-" + id);
                }
                else if (!error && (stdout.indexOf("[noAst]") != -1) || stdout.indexOf("[noLinks]") != -1) {
                    console.log(colors.yellow("Focusr / (" + id + ")"));
                    console.timeEnd("focusr-" + id);
                }
                else {
                    console.log(colors.red("Focusr X (" + id + ")"));
                }
                runFocusr(id + 1, limit);
            });
    }
    catch (ex) {
        console.log("File " + id + " missing");
        console.log(colors.red("Focusr X (" + id + ") missing"));
        runFocusr(id + 1, limit);
    }
}

function processUrl(id) {
    if (id == 500) {
        return;
    }
    var site = "http://188.166.134.121/research/thesis/topsites/testSites/" + id + "/";
    try {
        fs.accessSync("../topsites/testSites/" + id + "/focused.html");
        var url = "http://" + wptUrl + "/runtest.php?url=" + encodeURIComponent(site + "original.html") + "&k=" + key + "&f=json&fvonly=1" + location;
        var url2 = "http://" + wptUrl + "/runtest.php?url=" + encodeURIComponent(site + "focused.html") + "&k=" + key + "&f=json&fvonly=1" + location;

        console.log("File " + id + " working");
        (function (url, url2, site, id) {
            request(url, function (error, response, jsonData) {
                if (!error && response.statusCode == 200) {
                    jsonData = JSON.parse(jsonData);
                    if (jsonData["statusCode"] === 200) {
                        console.log(jsonData["data"]["jsonUrl"]);
                        fs.appendFile('myWPTIDs_wpt.txt', jsonData["data"]["jsonUrl"] + "," + id + "," + site + ",original\n");
                    }
                    else {
                        console.log(JSON.stringify(jsonData));
                    }
                }
                else {
                    console.log(" Error fetching remote site '" + "'");
                }
            });


            request(url2, function (error, response, jsonData) {
                if (!error && response.statusCode == 200) {
                    jsonData = JSON.parse(jsonData);
                    if (jsonData["statusCode"] === 200) {
                        console.log(jsonData["data"]["jsonUrl"]);
                        fs.appendFile('myWPTIDs_wpt.txt', jsonData["data"]["jsonUrl"] + "," + id + "," + site + ",focused\n");
                    }
                    else {
                        console.log(JSON.stringify(jsonData));
                    }
                }
                else {
                    console.log(" Error fetching remote site '" + "'");
                }
            });
        })(url, url2, site, id);
    }
    catch (ex) {
        console.log(colors.red("File " + id + " missing"));
    }
}


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
function getTest(testUrl, id) {
	console.log("trying: " + testUrl);
    (function (testUrl, id) {
        request(testUrl, function (error, response, jsonData) {
            if (!error && response.statusCode == 200) {
                try {
                    jsonData = JSON.parse(jsonData);
                    if (jsonData["statusText"] === "Test Complete") {
                        console.log("done " + jsonData["data"]["url"]);
                        fs.appendFile('testResults-final.txt', jsonData["data"]["runs"]["1"]["firstView"]["render"] + "," + id + "\n");
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
    })(testUrl, id);
}
function getTestResults(start) {
	fs.readFile("myWPTIDs_wpt.txt", 'utf8', function (err, data) {
		if (!err) {
			var lines = data.split(/\r?\n/);
			var cooldown = 0;
			for (var n = start; n < lines.length; n++) {
				cooldown++;
				var split = lines[n].split(",");
                var testUrl = split[0];
                var id = split[1];
				if (testUrl === "") {
					continue;
				}
				setTimeout(getTest, cooldown * 2000, testUrl, id);

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
	fs.readFile("testResults-final.txt", 'utf8', function (err, data) {
			if (!err) {
				var lines = data.split(/\r?\n/);
				for (var n = 0; n < lines.length; n++) {
					var split = lines[n].split(",");
					var time = split[0];
					var site = split[1];

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

				var timesum = 0;
				for (var i = 0; i < times.length; i++) {
					timesum += times[i];
				}

				console.log("-----------");
				console.log("Total sites: 500");
				console.log("Processed sites: " + (500 - skipped));
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
			}
			else {
				console.log("Tests file can not be opened");
			}
		}
	);
}
//----------------------------------
getHTML(500);

//runFocusr(0, 500);

//var i = 0;
//for (var n = 400; n < 500; n++) {
//    i++;
//    setTimeout(processUrl, i * 2000, n);
//}

//getTestResults(0);

//calculateTimes();