
//-----------------------
// GLOBAL VARS
//-----------------------

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
    global = {},
    defaultConfig = {
        "autoOpen": false,
        "debug": false,
        "allowJs": false,
        "processExternalCss": true,
        "inlineNonCritical": false,
        "groups": []
    },
    defaultGroup = {
        "enabled": true,
        "baseDir": "tests/",
        "inputFile": "",
        "outputFile": "",
        "alwaysInclude": [],
        "httpAuth": "",
        "wordpress": false,
        "viewport": [1200, 900],
        "outputJS": false
    };


//-----------------------
// FUNCTIONS
//-----------------------

function parseConfig(json) {
    console.log("------------------");
    console.log("Focusr run stared\n");
    var groupID = 1;
    //CLI
    if (process.argv[2] !== undefined) {
        global = extendConfig(defaultConfig, {});
        global["runningGroups"] = 0;
        var newGroup = extendConfig(defaultGroup, {});
        newGroup["baseDir"] = process.argv[2];
        newGroup["inputFile"] = process.argv[3];
        newGroup["outputFile"] = process.argv[4];
        newGroup["groupID"] = groupID++;
        global["runningGroups"]++;
        parseGroup(newGroup);
    }
    else {
        global = extendConfig(defaultConfig, json);
        global["runningGroups"] = 0;
        for (var i = 0; i < global["groups"].length; i++) {
            var group = i;
            global["groups"][i] = extendConfig(defaultGroup, global["groups"][i]);
            var groupObject = global["groups"][i];


            if (groupObject["enabled"]) {
                if (groupObject["wordpress"]) {
                    var url = groupObject["inputFile"] + "?focusr=yes";
                    if (groupObject["httpAuth"] !== "") {
                        url = injectAuth(url, groupObject["httpAuth"]);
                    }

                    request(url, function (error, response, data) {
                        if (!error && response.statusCode == 200) {
                            var links = JSON.parse(data);
                            for (var key in links) {
                                if (links.hasOwnProperty(key)) {
                                    var newGroup = extendConfig(defaultGroup, global["groups"][group]);
                                    newGroup["wordpress"] = false;
                                    newGroup["inputFile"] = links[key] + "?focusr=no";
                                    newGroup["outputFile"] = key + ".css";
                                    newGroup["outputJS"] = key + ".js";
                                    newGroup["groupID"] = groupID++;
                                    global["runningGroups"]++;
                                    parseGroup(newGroup);
                                }
                            }
                        }
                        else {
                            console.log(groupObject["groupID"] + " Error fetching links from wordpress URL " + groupObject["inputFile"] + "?focusr=yes");
                        }
                    });
                }
                else {
                    groupObject["groupID"] = groupID++;
                    global["runningGroups"]++;
                    parseGroup(groupObject);
                }
            }
        }
    }


}

function extendConfig(baseConfig, userConfig) {
    var newConfig = {};
    for (var key in baseConfig) {
        if (baseConfig.hasOwnProperty(key)) {
            newConfig[key] = baseConfig[key];
        }
    }
    for (key in userConfig) {
        if (userConfig.hasOwnProperty(key)) {
            newConfig[key] = userConfig[key];
        }
    }
    return newConfig;
}

function parseGroup(groupObject) {
    groupObject["remainingCSSFiles"] = 0;
    if (isRemoteUrl(groupObject["inputFile"])) {
        var url = groupObject["inputFile"];
        if (groupObject["httpAuth"] !== "") {
            url = injectAuth(url, groupObject["httpAuth"]);
        }
        request(url, function (error, response, htmlData) {
            if (!error && response.statusCode == 200) {
                groupObject["HTML"] = htmlData;
                findCSSFiles(groupObject);
            }
            else {
                console.log(groupObject["groupID"] + " Error fetching remote file");
            }
        });

    }
    else {
        groupObject["HTML"] = fs.readFileSync(groupObject["baseDir"] + groupObject["inputFile"], "utf-8");
        findCSSFiles(groupObject);
    }
}

function injectAuth(url, auth) {
    if (url.indexOf("http://", 0) === 0) {
        return url.replace("http://", "http://" + auth + "@");
    }
    else if (url.indexOf("https://", 0) === 0) {
        return url.replace("http://", "https://" + auth + "@");
    }
    else if (url.indexOf("www.", 0) === 0) {
        return url.replace("www.", "http://" + auth + "@www.");
    }
    return "";
}

function findCSSFiles(groupObject) {
    jsdom.env({
        html: groupObject["HTML"],
        done: function (error, window) {
            if (!error) {
                var stylesheets = window.document.head.querySelectorAll("link[rel='stylesheet']");
                for (var i = 0; i < stylesheets.length; i++) {
                    var cssFile = stylesheets[i].getAttribute("href");
                    if (!isRemoteUrl(cssFile) || (global["processExternalCss"] && isRemoteUrl(cssFile))) {
                        groupObject["remainingCSSFiles"]++;
                        readCSS(cssFile, groupObject);
                    }
                }
            }
            else {
                console.log("[" + groupObject["groupID"] + "] A jsdom error occurred: " + error);
            }
        }
    });
}

function readCSS(CSSUrl, groupObject) {
    var unmodifiedCSSUrl = CSSUrl;


    if (!isRemoteUrl(CSSUrl) && isRemoteUrl(groupObject["inputFile"])) {
        CSSUrl = urlparse.resolve(groupObject["inputFile"], CSSUrl);
    }

    if (isRemoteUrl(CSSUrl)) {
        var url = CSSUrl;
        if (groupObject["httpAuth"] !== "") {
            url = injectAuth(url, groupObject["httpAuth"]);
        }
        request(url, function (error, response, cssData) {
            if (!error && response.statusCode == 200) {
                createAST(cssData.toString(), unmodifiedCSSUrl, groupObject);
            }
            else {
                console.log(groupObject["groupID"] + " Error fetching remote file '" + CSSUrl + "'");
                createAST(undefined, unmodifiedCSSUrl, groupObject);
            }
        });
    }
    else {
        if (isBaseRelative(CSSUrl)) {
            CSSUrl = groupObject["baseDir"] + CSSUrl.substring(1);
        }
        else {
            CSSUrl = groupObject["baseDir"] + path.dirname(groupObject["inputFile"]).substring(1) + CSSUrl;
        }

        fs.readFile(CSSUrl, 'utf8', function (error, cssData) {
            if (!error) {
                createAST(cssData, unmodifiedCSSUrl, groupObject);
            }
            else {
                console.log("[" + groupObject["groupID"] + "] Error fetching local file '" + CSSUrl + "'");
                createAST(undefined, unmodifiedCSSUrl, groupObject);
            }
        });
    }

}

function createAST(cssData, unmodifiedCSSUrl, groupObject) {
    groupObject["remainingCSSFiles"]--;

    if (cssData !== undefined) {
        if (groupObject["CSSAST"] === undefined) {
            groupObject["CSSAST"] = css.parse(cssData, {silent: true});
        }
        else {
            var CSSAST = css.parse(cssData, {silent: true});
            groupObject["CSSAST"]["stylesheet"]["rules"] = groupObject["CSSAST"]["stylesheet"]["rules"].concat(CSSAST["stylesheet"]["rules"]);
        }
    }

    if (groupObject["remainingCSSFiles"] == 0) {
        changeRelativeUrlsInAst(groupObject["CSSAST"]["stylesheet"]["rules"], unmodifiedCSSUrl);
        initCritical(groupObject["CSSAST"]["stylesheet"]["rules"], groupObject);
        if (groupObject["alwaysInclude"].length > 0) {
            for (var i = 0; i < groupObject["alwaysInclude"].length; i++) {
                markAlwaysIncludesAsCritical(groupObject["CSSAST"]["stylesheet"]["rules"], groupObject["alwaysInclude"][i]);
            }
        }
        checkIfSelectorsHit(groupObject, groupObject["CSSAST"]);
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

function checkIfSelectorsHit(groupObject, CSSAST) {

    var tmpCssFile = groupObject["baseDir"] + groupObject["outputFile"] + Date.now() + ".txt";
    var viewportW = groupObject["viewport"][0];
    var viewportH = groupObject["viewport"][1];
    var html = groupObject["HTML"];

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
                writeFile(tmpCssFile, JSON.stringify(CSSAST));


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

function injectInlineCss(minifiedCriticalCss, minifiedNonCriticalCss, groupObject, tmpCssFile) {
    jsdom.env({
        html: groupObject["HTML"],
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

                    if (groupObject["outputJS"]) {
                        writeFile(groupObject["baseDir"] + groupObject["outputJS"], generateLoadCSSJS(window));
                        console.log("[" + groupObject["groupID"] + "] File '" + groupObject["baseDir"] + groupObject["outputJS"] + "' generated ");
                    }
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
                    for (var i = 0; i < stylesheets.length; i++) {
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
                        jsForLoadCss.innerHTML = generateLoadCSSJS(stylesheets);
                        body.appendChild(jsForLoadCss);
                    }

                    // Save HTML for possible next CSS file run
                    groupObject["HTML"] = window.document.documentElement.outerHTML;
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
                        body.innerHTML = '<div style="border:3px solid red;width:' + groupObject["viewport"][0] + 'px; height:' + groupObject["viewport"][1] + 'px;position:absolute;top:0;left:0;z-index:2147483647"></div>' + body.innerHTML;
                        groupObject["HTML"] = window.document.documentElement.outerHTML;
                    }

                    // Save it
                    writeFile(groupObject["baseDir"] + groupObject["outputFile"], groupObject["HTML"]);

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

//-----------------------
// HELPER FUNCTIONS
//-----------------------

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

function isRemoteUrl(url) {
    return url.indexOf("http://", 0) === 0 || url.indexOf("https://", 0) === 0 || url.indexOf("www.", 0) === 0;
}

function isBaseRelative(url) {
    return url.lastIndexOf("/", 0) === 0;
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

function changeRelativeUrlsInAst(rules, unmodifiedCSSUrl) {
    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (rule["rules"] !== undefined) {
            changeRelativeUrlsInAst(rule["rules"], unmodifiedCSSUrl);
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
                        var newPath = "url(" + prefix + urlparse.resolve(unmodifiedCSSUrl, regexResult) + prefix + ")";
                        declaration["value"] = declaration["value"].replace(originalValue, newPath);
                    }

                }
            }
        }
    }
}

function generateLoadCSSJS(stylesheets) {
    var linksToLoad = [];
    for (var i = 0; i < stylesheets.length; i++) {
        linksToLoad.push(stylesheets[i].getAttribute("href"));
    }
    return 'var fl=function(){for(var e=["' + linksToLoad.join('","') + '"],t=0;t<e.length;t++){var n=document.createElement("link");n.rel="stylesheet",n.href=e[t],document.body.appendChild(n)}},raf=requestAnimationFrame||mozRequestAnimationFrame||webkitRequestAnimationFrame||msRequestAnimationFrame;raf?raf(function(){window.setTimeout(fl,0)}):window.addEventListener("load",fl);';
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

//-----------------------
// MAIN CALL
//-----------------------

fs.readFile("config.json", 'utf8', function (err, data) {
    if (!err) {
        parseConfig(JSON.parse(data));
    }
    else {
        console.log("Config file can not be opened");
    }
});