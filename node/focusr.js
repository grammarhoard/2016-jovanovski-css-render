// ----------------------------------------------------------------------------------
// NODE.JS MODULES
// ----------------------------------------------------------------------------------

var _phantomJs = require('phantomjs-prebuilt'),
    _childProcess = require('child_process'),
    _reworkCss = require('css'),
    _cssCleaner = require('clean-css'),
    _fileSystem = require('fs'),
    _jsDOM = require("jsdom"),
    _path = require('path'),
    _request = require('request');

var _focusrAst = require("./lib/ast.js"),
    _focusrHelper = require("./lib/helpers.js"),
    _focusrWordpress = require("./lib/wordpress.js"),
    _focusrDom = require("./lib/dom.js");

// ----------------------------------------------------------------------------------
// FOCUSR FUNCTIONS
// ----------------------------------------------------------------------------------

function readConfig(filename) {
    var result = undefined;
    try {
        result = _fileSystem.readFileSync(filename, 'utf8');
    }
    catch (exception) {
        _focusrHelper.log(-1, "Can't open configuration file: " + filename + ": " + exception.message, 2);
    }
    return result;
}

function parseConfig(configFileName) {
    var userConfigString = readConfig(configFileName);
    if (userConfigString === undefined) {
        return;
    }
    var userConfig = JSON.parse(userConfigString);
    var groupID = 1;
    var config = _focusrHelper.extendDefaultConfig(userConfig);
    config["runningGroups"] = 0;
    _focusrHelper.logGroupInfo(config["groups"]);
    for (var i = 0; i < config["groups"].length; i++) {
        var groupObject = config["groups"][i] = _focusrHelper.extendGroupConfig(config["groups"][i]);
        if (!groupObject["enabled"]) {
            continue;
        }
        groupObject["groupID"] = groupID++;
        if (groupObject["wordpress"]) {
            _focusrWordpress.getWordpressGroups(config, groupObject, function (wordpressGroups) {
                for (var j = 0; j < wordpressGroups.length; j++) {
                    parseGroup(config, wordpressGroups[j]);
                }
            });
        }
        else {
            config["runningGroups"]++;
            parseGroup(config, groupObject);
        }
    }
}

function cliInit(baseDir, inputFile, outputFile) {
    var config = _focusrHelper.extendDefaultConfig({});
    config["runningGroups"] = 1;
    var groupObject = _focusrHelper.extendGroupConfig({});
    groupObject["groupID"] = 1;
    groupObject["baseDir"] = baseDir;
    groupObject["inputFile"] = inputFile;
    groupObject["outputFile"] = outputFile;
    parseGroup(config, groupObject);
}

function parseGroup(config, groupObject) {
    groupObject["remainingCSSFiles"] = 0;
    if (_focusrHelper.isRemoteUrl(groupObject["inputFile"])) {
        var url = _focusrHelper.prepUrlAuthentication(groupObject["inputFile"], groupObject["httpAuth"]);
        _request(url, function (error, response, html) {
            if (!error && response.statusCode === 200) {
                groupObject["HTML"] = html;
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "Error fetching remote file", 2);
            }
        });
    }
    else {
        var originalHtml = _fileSystem.readFileSync(groupObject["baseDir"] + groupObject["inputFile"], "utf-8");
        fixProtocollessLinks(originalHtml, groupObject, function (fixedHtml) {
            groupObject["HTML"] = fixedHtml;
            findCSSFiles(config, groupObject);
        });

    }
}
function findCSSFiles(config, groupObject) {
    _jsDOM.env({
        html: groupObject["HTML"],
        done: function (error, window) {
            if (!error) {
                window = _focusrDom.saveBaseTagIfPresent(groupObject, window);
                var stylesheets = window.document.head.querySelectorAll("link[rel='stylesheet']");
                if (stylesheets.length > 0) {
                    processCSSFiles(config, groupObject, stylesheets);
                }
                else {
                    _focusrHelper.log(groupObject["groupID"], "No linked stylesheets found [noLinks]", 2);
                    config["runningGroups"]--;
                    _focusrHelper.printOutroIfNeeded(config);
                }
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "A jsdom error occurred: " + error, 2);
            }
        }
    });
}

function fixProtocollessLinks(originalHtml, groupObject, callback) {
    _jsDOM.env({
        html: originalHtml,
        done: function (error, window) {
            if (!error) {
                window = _focusrDom.saveBaseTagIfPresent(groupObject, window);
                var srcElements = window.document.documentElement.querySelectorAll("*[src]");

                for (var i = 0; i < srcElements.length; i++) {
                    var srcElement = srcElements[i];
                    if (srcElement.getAttribute("src").startsWith("//")) {
                        srcElement.setAttribute("src", "http:" + srcElement.getAttribute("src"));
                    }
                }
                callback(window.document.documentElement.outerHTML);
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "A jsdom error occurred: " + error, 2);
            }
        }
    });
}

function processCSSFiles(config, groupObject, stylesheets) {
    for (var i = 0; i < stylesheets.length; i++) {
        var cssUrl = stylesheets[i].getAttribute("href");
        if (!_focusrHelper.isRemoteUrl(cssUrl) || (config["processExternalCss"] && _focusrHelper.isRemoteUrl(cssUrl))) {
            groupObject["remainingCSSFiles"]++;
            readCSSFile(config, cssUrl, groupObject);
        }
    }
}

function readCSSFile(config, cssUrl, groupObject) {
    var unmodifiedCssUrl = cssUrl;
    cssUrl = _focusrHelper.prepCssUrl(cssUrl, groupObject["inputFile"], groupObject["baseUrl"]);

    if (_focusrHelper.isRemoteUrl(cssUrl)) {
        var url = _focusrHelper.prepUrlAuthentication(cssUrl, groupObject["httpAuth"]);
        _request(url, function (error, response, cssData) {
            parseReadCSSFile(config, groupObject, error, cssData, cssUrl, unmodifiedCssUrl);
        });
    }
    else {
        cssUrl = _focusrHelper.prepLocalUrl(cssUrl, groupObject);
        _fileSystem.readFile(cssUrl, 'utf8', function (error, cssData) {
            parseReadCSSFile(config, groupObject, error, cssData, cssUrl, unmodifiedCssUrl);
        });
    }
}

function parseReadCSSFile(config, groupObject, error, responseData, cssUrl, unmodifiedCssUrl) {
    var data = undefined;
    if (!error) {
        data = responseData.toString();
        _focusrHelper.log(groupObject["groupID"], "Fetched file: '" + cssUrl + "'");
    }
    else {
        _focusrHelper.log(groupObject["groupID"], "Error fetching remote file '" + cssUrl + "'", 2);
    }
    createASTFromCSS(config, groupObject, data, unmodifiedCssUrl);
}

function createASTFromCSS(config, groupObject, cssData, unmodifiedCssUrl) {
    groupObject["remainingCSSFiles"]--;

    if (cssData !== undefined) {
        if (groupObject["CSSAST"] === undefined) {
            groupObject["CSSAST"] = _reworkCss.parse(cssData, {silent: true});
        }
        else {
            var CSSAST = _reworkCss.parse(cssData, {silent: true});
            groupObject["CSSAST"] = _focusrAst.mergeAsts(groupObject["CSSAST"], CSSAST);
        }
    }

    if (groupObject["remainingCSSFiles"] === 0) {
        if (groupObject["CSSAST"] === undefined) {
            _focusrHelper.log(groupObject["groupID"], "No CSS AST to work on [noAst]", 2);
            return;
        }
        var rules = groupObject["CSSAST"]["stylesheet"]["rules"];
        _focusrAst.initialPassOnRules(rules, unmodifiedCssUrl, groupObject);

        prepPhantomJs(config, groupObject, groupObject["CSSAST"]);
    }
}

function prepPhantomJs(config, groupObject, CSSAST) {
    var tmpCssFile = groupObject["baseDir"] + groupObject["outputFile"] + Date.now() + ".txt";
    var viewportW = groupObject["viewport"][0];
    var viewportH = groupObject["viewport"][1];

    var htmlFile = groupObject["baseDir"] + groupObject["outputFile"];
    if (_focusrHelper.isRemoteUrl(groupObject["inputFile"])) {
        htmlFile += ".html";
    }

    if (!config["allowJs"]) {
        removeJavascript(config, groupObject, tmpCssFile, viewportW, viewportH, htmlFile, CSSAST);
    }
    else {
        callPhantomJs(config, groupObject, tmpCssFile, viewportW, viewportH, htmlFile, CSSAST);
    }

}

function removeJavascript(config, groupObject, tmpCssFile, viewportW, viewportH, htmlFile, CSSAST) {
    _jsDOM.env({
        html: groupObject["HTML"],
        done: function (error, window) {
            var scriptTags = window.document.getElementsByTagName("script");
            for (var i = 0; i < scriptTags.length; i++) {
                scriptTags[i].parentNode.removeChild(scriptTags[i]);
            }
            groupObject["HTML"] = window.document.documentElement.outerHTML;
            callPhantomJs(config, groupObject, tmpCssFile, viewportW, viewportH, htmlFile, CSSAST);
        }
    });
}

function callPhantomJs(config, groupObject, tmpCssFile, viewportW, viewportH, htmlFile, CSSAST) {

    var pathToHtml = htmlFile;
    if (_focusrHelper.isRemoteUrl(groupObject["inputFile"])) {
        pathToHtml = groupObject["inputFile"];
    }
    else {
        _focusrHelper.writeFile(htmlFile, groupObject["HTML"]);
    }
    _focusrHelper.writeFile(tmpCssFile, JSON.stringify(CSSAST));

    if (config["inlineAllCss"]) {
        checkPhantomJsOutput(config, groupObject, tmpCssFile, false, "success", "");
        return;
    }

    var phantomArguments = [_path.join(__dirname, 'phantomJS.js'), pathToHtml, tmpCssFile, viewportW, viewportH, "--proxy-type=none"];
    var execOptions = {
        encoding: 'utf8',
        timeout: config["renderTimeout"],
        killSignal: 'SIGTERM'
    };

    _focusrHelper.log(groupObject["groupID"], "Calling PhantomJS");
    _childProcess.execFile(_phantomJs.path, phantomArguments, execOptions, function (error, output, errorOutput) {
        checkPhantomJsOutput(config, groupObject, tmpCssFile, error, output, errorOutput);
    });
}

function checkPhantomJsOutput(config, groupObject, tmpCssFile, error, output, errorOutput) {
    if (!error) {
        var result = output.trim();
        if (result === "success") {
            _focusrHelper.log(groupObject["groupID"], "PhantomJS reported back");
            var parseError = false;
            var processedAST;
            try {
                processedAST = JSON.parse(_fileSystem.readFileSync(tmpCssFile, "utf-8"));
            }
            catch (exception) {
                parseError = true;
                _focusrHelper.log(groupObject["groupID"], "Error occurred while parsing PhantomJS output: " + exception.message, 2);
            }

            if (!parseError) {
                generateCriticalCSSAST(config, groupObject, processedAST, tmpCssFile);
            }
        }
        else {
            _focusrHelper.log(groupObject["groupID"], "Error occurred while parsing PhantomJS output: " + output, 2);
        }

    }
    else {
        if (output === "") {
            _focusrHelper.log(groupObject["groupID"], "The PhantomJS call timed out after " + config["renderTimeout"] + "ms", 2);
        }
        else {
            _focusrHelper.log(groupObject["groupID"], "A PhantomJS error occurred: " + output + " " + errorOutput, 2);
        }
    }
}

function generateCriticalCSSAST(config, groupObject, processedAST, tmpCssFile) {
    var originalRules = processedAST["stylesheet"]["rules"],
        criticalCssAst = JSON.parse(JSON.stringify(processedAST)),
        criticalRules = criticalCssAst["stylesheet"]["rules"];

    for (var i = 0; i < originalRules.length; i++) {
        if (!originalRules[i]["critical"] && !config["inlineAllCss"]) {
            criticalRules[i] = undefined;
        }
    }

    criticalCssAst["stylesheet"]["rules"] = _focusrHelper.removeUndefinedRules(criticalRules);

    var criticalCss = _reworkCss.stringify(criticalCssAst, {silent: true}),
        minifiedCriticalCss = new _cssCleaner().minify(criticalCss).styles;

    generateResult(config, groupObject, minifiedCriticalCss, tmpCssFile);
}

function generateResult(config, groupObject, criticalCss, tmpCssFile) {
    _jsDOM.env({
        html: groupObject["HTML"],
        done: function (error, window) {
            if (error) {
                _focusrHelper.log(groupObject["groupID"], "A jsdom error occurred: " + error, 2);
                return;
            }

            if (_focusrHelper.isRemoteUrl(groupObject["inputFile"])) {
                outputForRemoteInput(groupObject, criticalCss, window);
            }
            else {
                outputForLocalInput(config, groupObject, criticalCss, window)
            }

            config["runningGroups"]--;
            _focusrHelper.deleteFile(tmpCssFile);
            _focusrHelper.printOutroIfNeeded(config);
        }
    });
}

function outputForRemoteInput(groupObject, criticalCss, window) {
    var head = window.document.head || window.document.getElementsByTagName('head')[0];
    var stylesheets = head.querySelectorAll("link[rel='stylesheet']");

    _focusrHelper.writeFile(groupObject["baseDir"] + groupObject["outputFile"], criticalCss, true, groupObject["groupID"]);

    if (groupObject["outputJS"]) {
        _focusrHelper.writeFile(groupObject["baseDir"] + groupObject["outputJS"], _focusrDom.generateLoadJS(stylesheets), true, groupObject["groupID"]);
    }
}

function outputForLocalInput(config, groupObject, criticalCss, window) {
    var head = window.document.head || window.document.getElementsByTagName('head')[0];
    var body = window.document.body || window.document.getElementsByTagName('body')[0];
    var stylesheets = head.querySelectorAll("link[rel='stylesheet']");

    head = _focusrDom.removeLinkTags(head, stylesheets);
    head.appendChild(_focusrDom.generateStyleTag(window, criticalCss));
    body.appendChild(_focusrDom.generateLoadCSSJSTag(window, stylesheets));

    if (config["debug"]) {
        body.innerHTML = _focusrDom.insertDebugBox(body, groupObject);
    }
    var resultHTML = window.document.documentElement.outerHTML;
    _focusrHelper.writeFile(groupObject["baseDir"] + groupObject["outputFile"], resultHTML, true, groupObject["groupID"]);

    if (groupObject["outputJS"]) {
        _focusrHelper.writeFile(groupObject["baseDir"] + groupObject["outputJS"], _focusrDom.generateLoadJS(stylesheets), true, groupObject["groupID"]);
    }

}

// ----------------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------------

function initialize() {
    _focusrHelper.printIntro();
    parseConfig("config.json");
}

//initialize();
if (process.argv.length === 2) {
    initialize();
}
else if (process.argv.length === 5) {
    cliInit(process.argv[2], process.argv[3], process.argv[4]);
}
else {
    _focusrHelper.printUsage();
}
//process.argv