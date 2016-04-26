var fs = require('fs'),
    mkdirp = require('mkdirp'),
    getDirName = require('path').dirname,
    css = require('css'),
    path = require('path'),
    CleanCSS = require('clean-css'),
    jsdom = require("jsdom"),
    urlparse = require("url"),
    request = require('request'),
    MediaQuery = require('css-mediaquery'),
    childProcess = require('child_process'),
    phantomjs = require('phantomjs-prebuilt'),
    open = require("open"),
    binPath = phantomjs.path,
    global = {};

function parseConfig(json) {
    console.log("------------------");
    console.log("Focusr run stared\n");

    var id = 1;
    global = json;
    global["runningGroups"] = 0;
    for (var i = 0; i < json["groups"].length; i++) {
        var groupObject = json["groups"][i];
        if (groupObject["enabled"]) {
            groupObject["groupID"] = id++;
            global["runningGroups"]++;
            parseGroup(groupObject);
        }
    }
}

function parseGroup(groupObject) {
    groupObject["runs"] = 0;
    if (isRemoteUrl(groupObject["inputFile"])) {
        request(groupObject["inputFile"], function (error, response, htmlData) {
            if (!error && response.statusCode == 200) {
                groupObject["html"] = htmlData;
                findCSSInHTML(groupObject);
            }
            else {
                console.log(groupObject["groupID"] + " Error fetching remote file '" + cssFile + "'");
            }
        });

    }
    else {
        groupObject["html"] = fs.readFileSync(groupObject["baseDir"] + groupObject["inputFile"], "utf-8");
        findCSSInHTML(groupObject);
    }
}

function findCSSInHTML(groupObject) {
    jsdom.env({
        html: groupObject["html"],
        done: function (error, window) {
            if (error) {
                console.log("[" + groupObject["groupID"] + "] A jsdom error occurred: " + error);
            }
            else {
                var stylesheets = window.document.head.querySelectorAll("link[rel='stylesheet']");
                for (var i = 0; i < stylesheets.length; i++) {
                    var cssFile = stylesheets[i].getAttribute("href");
                    if (!isRemoteUrl(cssFile) || (global["processExternalCss"] && isRemoteUrl(cssFile))) {
                        groupObject["runs"]++;
                        readCss(cssFile, groupObject);
                    }
                }
            }
        }
    });
}

function readCss(cssFile, groupObject) {
    var originalCssUrl = cssFile;

    if (!isRemoteUrl(cssFile) && isRemoteUrl(groupObject["inputFile"])) {
        cssFile = urlparse.resolve(groupObject["inputFile"], cssFile);
    }

    if (isRemoteUrl(cssFile)) {
        request(cssFile, function (error, response, cssData) {
            if (!error && response.statusCode == 200) {
                createAST(cssData.toString(), originalCssUrl, groupObject);
            }
            else {
                console.log(groupObject["groupID"] + " Error fetching remote file '" + cssFile + "'");
                createAST(undefined, originalCssUrl, groupObject);
            }
        });
    }
    else {
        if (isBaseRelative(cssFile)) {
            cssFile = groupObject["baseDir"] + cssFile.substring(1);
        }
        else {
            cssFile = groupObject["baseDir"] + path.dirname(groupObject["inputFile"]).substring(1) + cssFile;
        }

        fs.readFile(cssFile, 'utf8', function (error, cssData) {
            if (!error) {
                createAST(cssData, originalCssUrl, groupObject);
            }
            else {
                console.log("[" + groupObject["groupID"] + "] Error fetching local file '" + cssFile + "'");
                createAST(undefined, originalCssUrl, groupObject);
            }
        });
    }

}

function isRemoteUrl(url) {
    return url.lastIndexOf("http://", 0) === 0 || url.lastIndexOf("https://", 0) === 0 || url.lastIndexOf("www.", 0) === 0;
}

function isBaseRelative(url) {
    return url.lastIndexOf("/", 0) === 0;
}

function createAST(cssData, originalCssUrl, groupObject) {
    groupObject["runs"]--;
    if (cssData !== undefined) {
        if (groupObject["cssAst"] === undefined) {
            groupObject["cssAst"] = css.parse(cssData, {silent: true});
        }
        else {
            var cssAst = css.parse(cssData, {silent: true});
            groupObject["cssAst"]["stylesheet"]["rules"] = groupObject["cssAst"]["stylesheet"]["rules"].concat(cssAst["stylesheet"]["rules"]);
        }
    }

    if (groupObject["runs"] == 0) {
        changeRelativeUrlsInAst(groupObject["cssAst"]["stylesheet"]["rules"], originalCssUrl);
        initCritical(groupObject["cssAst"]["stylesheet"]["rules"], groupObject);
        if (groupObject["alwaysInclude"] !== undefined) {
            for (var i = 0; i < groupObject["alwaysInclude"].length; i++) {
                markAlwaysIncludesAsCritical(groupObject["cssAst"]["stylesheet"]["rules"], groupObject["alwaysInclude"][i]);
            }
        }
        checkIfSelectorsHit(groupObject, groupObject["cssAst"]);
    }

}

function initCritical(rules, groupObject) {
    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (rule["type"] === "media") {
            rule["critical"] = mediaQueryMatchesViewport(rule["media"], groupObject["viewport"][0], groupObject["viewport"][1]);
        }
        else {
            rule["critical"] = false;
        }
    }
}

function changeRelativeUrlsInAst(rules, originalCssUrl) {
    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (rule["rules"] !== undefined) {
            changeRelativeUrlsInAst(rule["rules"], originalCssUrl);
        }
        else if (rule["declarations"] !== undefined) {
            for (var j = 0; j < rule["declarations"].length; j++) {
                var declaration = rule["declarations"][j];
                var regexPattern = new RegExp("url\\(.*\\..*\\)");
                var regexResult = regexPattern.exec(declaration["value"]);
                if (regexResult !== null) {
                    var originalValue = regexResult.toString();
                    var prefix = "";
                    regexResult = regexResult.toString().substring(4, regexResult.toString().length - 1);
                    if (regexResult.indexOf("'") === 0 || regexResult.indexOf('"') === 0) {
                        prefix = regexResult.substring(0, 1);
                        regexResult = regexResult.substring(1, regexResult.length - 1);
                    }
                    if (!isRemoteUrl(regexResult)) {
                        var newPath = "url(" + prefix + urlparse.resolve(originalCssUrl, regexResult) + prefix + ")";
                        declaration["value"] = declaration["value"].replace(originalValue, newPath);
                    }

                }
            }
        }
    }
}

function markAlwaysIncludesAsCritical(rules, ruleToInclude) {
    var regexPattern = new RegExp(ruleToInclude);
    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (rule["rules"] !== undefined) {
            markAlwaysIncludesAsCritical(rule["rules"], ruleToInclude);
        }
        else if (rule["selectors"] !== undefined) {
            for (var j = 0; j < rule["selectors"].length; j++) {
                var selector = rule["selectors"][j];
                if (regexPattern.test(selector)) {
                    rule["critical"] = true;
                    break;
                }
            }
        }
    }
}

function mediaQueryMatchesViewport(mediaQuery, width, height) {
    return MediaQuery.match(mediaQuery, {
        width: width + 'px',
        height: height + 'px',
        type: 'screen'
    });
}

//ASYNC
function checkIfSelectorsHit(groupObject, cssAst) {

    var tmpCssFile = groupObject["baseDir"] + groupObject["outputFile"] + Date.now() + ".txt";
    var viewportW = groupObject["viewport"][0];
    var viewportH = groupObject["viewport"][1];
    var html = groupObject["html"];

    jsdom.env({
        html: html,
        done: function (error, window) {
            if (error) {
                console.log("[" + groupObject["groupID"] + "] A jsdom error occurred: " + error);
            }
            else {
                if (!global["allowJs"]) {
                    // Remove all <script> tags for PhantomJS to load faster
                    var scripts = window.document.getElementsByTagName("script");
                    for (var i = 0; i < scripts.length; i++) {
                        scripts[i].parentNode.removeChild(scripts[i]);
                    }
                }

                var htmlFile = groupObject["baseDir"] + groupObject["outputFile"];
                if (isRemoteUrl(groupObject["inputFile"])) {
                    htmlFile += ".html";
                }

                // Save script-stripped HTML to tmp file (since PhantomJS is annoyed by string HTML)
                writeFile(htmlFile, window.document.documentElement.outerHTML);

                // Save CSS selectors to tmp file because they may be too big for console argument
                writeFile(tmpCssFile, JSON.stringify(cssAst));


                console.log("[" + groupObject["groupID"] + "] Calling PhantomJS");

                var childArgs = [
                    path.join(__dirname, 'phantomjs-script.js'),
                    htmlFile,
                    tmpCssFile,
                    viewportW,
                    viewportH
                ];

                // Run PhantomJS
                childProcess.execFile(binPath, childArgs, function (err, stdout, stderr) {
                    if (!err) {
                        try {
                            var json = stdout.replace(/(\r\n|\n|\r)/gm, "");
                            if (json === "true") {
                                var processedAst = JSON.parse(fs.readFileSync(tmpCssFile, "utf-8"));
                                console.log("[" + groupObject["groupID"] + "] PhantomJS reported back");
                                sliceCss(groupObject, processedAst, tmpCssFile);
                            }
                            else {
                                console.log("[" + groupObject["groupID"] + "] A controlled exception occurred: " + json["errorMessage"] + " " + stdout);
                            }
                        }
                        catch (ex) {
                            console.dir("[" + groupObject["groupID"] + "] Unexpected output from PhantomJS: " + stdout + " " + stderr + " " + ex);
                        }
                    }
                    else {
                        console.log("[" + groupObject["groupID"] + "] A PhantomJS error occurred: " + err + " " + stdout + " " + stderr);
                    }
                });
            }
        }
    });


}

function sliceCss(groupObject, processedAst, tmpCssFile) {

    var criticalCssAst = JSON.parse(JSON.stringify(processedAst));
    var nonCriticalCssAst = JSON.parse(JSON.stringify(processedAst));

    for (var i = 0; i < processedAst["stylesheet"]["rules"].length; i++) {
        var rule = processedAst["stylesheet"]["rules"][i];
        if (rule["critical"]) {
            nonCriticalCssAst["stylesheet"]["rules"][i] = undefined;
        }
        else {
            criticalCssAst["stylesheet"]["rules"][i] = undefined;
        }
    }

    criticalCssAst["stylesheet"]["rules"] = balanceArray(criticalCssAst["stylesheet"]["rules"]);
    nonCriticalCssAst["stylesheet"]["rules"] = balanceArray(nonCriticalCssAst["stylesheet"]["rules"]);

    var criticalCss = css.stringify(criticalCssAst);
    var nonCriticalCss = css.stringify(nonCriticalCssAst);


    var minifiedCriticalCss = new CleanCSS().minify(criticalCss).styles;
    var minifiedNonCriticalCss = new CleanCSS().minify(nonCriticalCss).styles;
    injectInlineCss(minifiedCriticalCss, minifiedNonCriticalCss, groupObject, tmpCssFile);
}

function balanceArray(array) {
    var tmpArray = [];
    for (var i = 0; i < array.length; i++) {
        if (array[i] !== undefined) {
            tmpArray.push(array[i]);
        }
    }
    return tmpArray;
}

//ASYNC
function injectInlineCss(minifiedCriticalCss, minifiedNonCriticalCss, groupObject, tmpCssFile) {
    jsdom.env({
        html: groupObject["html"],
        done: function (error, window) {
            if (error) {
                console.log("A jsdom error occurred: " + error);
            }
            else {

                if (isRemoteUrl(groupObject["inputFile"])) {
                    if (groupObject["criticalCss"] === undefined) {
                        groupObject["criticalCss"] = "";
                    }
                    groupObject["criticalCss"] += minifiedCriticalCss;
                }
                else {
                    // Insert minified critical css in <style> tag
                    var head = window.document.head || window.document.getElementsByTagName('head')[0];
                    var body = window.document.body || window.document.getElementsByTagName('body')[0];
                    var criticalStyleTag = window.document.createElement('style');
                    criticalStyleTag.type = 'text/css';
                    if (criticalStyleTag.styleSheet) {
                        criticalStyleTag.styleSheet.cssText = minifiedCriticalCss;
                    } else {
                        criticalStyleTag.appendChild(window.document.createTextNode(minifiedCriticalCss));
                    }
                    head.appendChild(criticalStyleTag);


                    // Try and find <link> tag with CSS to remove it
                    var stylesheets = head.querySelectorAll("link[rel='stylesheet']");
                    var linksToLoad = [];
                    for (var i = 0; i < stylesheets.length; i++) {
                        linksToLoad.push(stylesheets[i].getAttribute("href"));
                        head.removeChild(stylesheets[i]);
                    }

                    if (global["inlineNonCritical"]) {
                        var nonCriticalStyleTag = window.document.createElement('style');
                        nonCriticalStyleTag.type = 'text/css';
                        if (nonCriticalStyleTag.styleSheet) {
                            nonCriticalStyleTag.styleSheet.cssText = minifiedNonCriticalCss;
                        } else {
                            nonCriticalStyleTag.appendChild(window.document.createTextNode(minifiedNonCriticalCss));
                        }
                        body.appendChild(nonCriticalStyleTag);
                    }
                    else {
                        var jsForLoadCss = window.document.createElement('script');
                        jsForLoadCss.innerHTML = "var cb = function () { var s = ['" + linksToLoad.join("','") + "'];for(var i=0;i< s.length;i++){var l = document.createElement('link');l.rel = 'stylesheet';l.href = s[i];var h = document.getElementsByTagName('head')[0];h.parentNode.insertBefore(l, h);}};var raf = requestAnimationFrame || mozRequestAnimationFrame || webkitRequestAnimationFrame || msRequestAnimationFrame;if (raf) raf(cb); else window.addEventListener('load', cb);";
                        body.appendChild(jsForLoadCss);
                    }


                    // Save HTML for possible next CSS file run
                    groupObject["html"] = window.document.documentElement.outerHTML;
                }

                // Delete tmp CSS file
                fs.unlink(tmpCssFile);

                global["runningGroups"]--;
                // Delete temp HTML file
                var htmlFile = groupObject["baseDir"] + groupObject["outputFile"];
                if (isRemoteUrl(groupObject["inputFile"])) {
                    htmlFile += ".html";
                }
                fs.unlink(htmlFile);

                if (isRemoteUrl(groupObject["inputFile"])) {
                    writeFile(groupObject["baseDir"] + groupObject["outputFile"], groupObject["criticalCss"]);
                }
                else {
                    // Insert debug viewport box
                    if (global["debug"]) {
                        body.innerHTML = '<div style="border: 3px solid red; width: ' + groupObject["viewport"][0] + 'px; height:' + groupObject["viewport"][1] + 'px;position:absolute;top:0;left:0;z-index:2147483647"></div>' + body.innerHTML;
                        groupObject["html"] = window.document.documentElement.outerHTML;
                    }

                    // Save it
                    writeFile(groupObject["baseDir"] + groupObject["outputFile"], groupObject["html"]);

                    //renderScreenshot(groupObject["baseDir"] + groupObject["inputFile"], groupObject["baseDir"] + path.dirname(groupObject["inputFile"]) + "/preprocess.png", groupObject["viewport"][0], groupObject["viewport"][1]);
                    //renderScreenshot(groupObject["baseDir"] + groupObject["outputFile"], groupObject["baseDir"] + path.dirname(groupObject["inputFile"]) + "/postprocess.png", groupObject["viewport"][0], groupObject["viewport"][1]);

                }
                console.log("[" + groupObject["groupID"] + "] File '" + groupObject["baseDir"] + groupObject["outputFile"] + "' generated ");

                if (global["autoOpen"]) {
                    open(groupObject["baseDir"] + groupObject["outputFile"]);
                }

                // Check if no more groups running
                if (global["runningGroups"] === 0) {
                    console.log("\nFocusr run ended");
                    console.log("------------------");
                }
            }
        }
    });
}

function renderScreenshot(url, imageName, width, height) {
    var childArgs = [
        path.join(__dirname, 'phantomjs-render.js'),
        url,
        imageName,
        width,
        height
    ];
    childProcess.execFile(binPath, childArgs, function (err, stdout, stderr) {
        console.log(stdout + " " + stderr);
    });
}

function writeFile(path, contents) {
    mkdirp(getDirName(path), function (error) {
        if (error) {
            console.log("Error writing file " + path);
        }
        else {
            fs.writeFileSync(path, contents, {flag: 'w'});
        }
    });
}
//---------------------------------------------------------------------

fs.readFile("config.json", 'utf8', function (err, data) {
    if (!err) {
        parseConfig(JSON.parse(data));
    }
    else {
        console.log("Config file can not be opened");
    }
});