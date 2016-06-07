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
    _request = require('request'),
    _urlParse = require("url");

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
    for (var i = 0; i < config["groups"].length; i++) {
        var groupObject = config["groups"][i] = _focusrHelper.extendGroupConfig(config["groups"][i]);
        if (!groupObject["enabled"]) {
            continue;
        }
        if (groupObject["wordpress"]) {
            _focusrWordpress.getWordpressGroups(config, groupObject, groupID++, function(wordpressGroups){
                for (var j = 0; j < wordpressGroups.length; j++) {
                    parseGroup(config, wordpressGroups[j]);
                }
            });
        }
        else {
            groupObject["groupID"] = groupID++;
            config["runningGroups"]++;
            parseGroup(config, groupObject);
        }
    }
}

function parseGroup(config, groupObject) {
    groupObject["remainingCSSFiles"] = 0;
    if (_focusrHelper.isRemoteUrl(groupObject["inputFile"])) {
        var url = _focusrHelper.prepUrlAuthentication(groupObject["inputFile"], groupObject["httpAuth"]);
        _request(url, function (error, response, html) {
            if (!error && response.statusCode == 200) {
                saveHTMLToGroup(config, groupObject, html);
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "Error fetching remote file", 2);
            }
        });
    }
    else {
        var html = _fileSystem.readFileSync(groupObject["baseDir"] + groupObject["inputFile"], "utf-8");
        saveHTMLToGroup(config, groupObject, html);
    }
}

function saveHTMLToGroup(config, groupObject, html) {
    groupObject["HTML"] = html;
    findCSSFiles(config, groupObject);
}

function findCSSFiles(config, groupObject) {
    _jsDOM.env({
        html: groupObject["HTML"],
        done: function (error, window) {
            if (!error) {
                window = _focusrDom.saveBaseTagIfPresent(groupObject, window);
                var stylesheets = window.document.head.querySelectorAll("link[rel='stylesheet']");
                if (stylesheets.length > 0) {
                    parseStyleSheets(config, groupObject, stylesheets);
                }
                else {
                    _focusrHelper.log(groupObject["groupID"], "No linked stylesheets found [noLinks]", 2);
                    config["runningGroups"]--;
                    printOutroIfNeeded(config);
                }
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "A jsdom error occurred: " + error, 2);
            }
        }
    });
}

function printOutroIfNeeded(config) {
    if (config["runningGroups"] == 0) {
        _focusrHelper.printOutro();
    }
}

function parseStyleSheets(config, groupObject, stylesheets) {
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
    _focusrHelper.log(groupObject["groupID"], "Found CSS file: '" + cssUrl + "'");

    if (_focusrHelper.isRemoteUrl(cssUrl)) {
        var url = _focusrHelper.prepUrlAuthentication(cssUrl, groupObject["httpAuth"]);
        _request(url, function (error, response, cssData) {
            var responseData = undefined;
            if (!error && response.statusCode == 200) {
                responseData = cssData.toString();
                _focusrHelper.log(groupObject["groupID"], "Fetched file: '" + cssUrl + "'", 1);
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "Error fetching remote file '" + cssUrl + "'", 2);
            }
            createAST(config, groupObject, responseData, unmodifiedCssUrl);
        });
    }
    else {
        // Base relative URL in local file fix
        if (_focusrHelper.isBaseRelative(cssUrl)) {
            cssUrl = groupObject["baseDir"] + cssUrl.substring(1);
        }
        // Relative URL in local file fix
        else {
            cssUrl = groupObject["baseDir"] + _path.dirname(groupObject["inputFile"]).substring(1) + cssUrl;
        }

        _fileSystem.readFile(cssUrl, 'utf8', function (error, cssData) {
            var responseData = undefined;
            if (!error) {
                responseData = cssData;
                _focusrHelper.log(groupObject["groupID"], "Fetched file: '" + cssUrl + "'", 1);
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "Error fetching remote file '" + cssUrl + "'", 2);
            }
            createAST(config, groupObject, responseData, unmodifiedCssUrl);
        });
    }

}

function createAST(config, groupObject, cssData, unmodifiedCssUrl) {
    groupObject["remainingCSSFiles"]--;

    // Successful fetch of data
    if (cssData !== undefined) {
        //First CSS file, build the initial AST tree
        if (groupObject["CSSAST"] === undefined) {
            groupObject["CSSAST"] = _reworkCss.parse(cssData, {silent: true});
        }
        //Already existing CSS AST, append newly parsed rules to it
        else {
            var CSSAST = _reworkCss.parse(cssData, {silent: true});
            groupObject["CSSAST"]["stylesheet"]["rules"] = groupObject["CSSAST"]["stylesheet"]["rules"].concat(CSSAST["stylesheet"]["rules"]);
        }
    }

    // All CSS files found in group processed
    if (groupObject["remainingCSSFiles"] == 0) {
        if (groupObject["CSSAST"] === undefined) {
            _focusrHelper.log(groupObject["groupID"], "No CSS AST to work on [noAst]", 2);
            _focusrHelper.printOutro();
            return;
        }
        // Transform all relative URLs in CSS into relative to the output file
        var rules = groupObject["CSSAST"]["stylesheet"]["rules"];
        //TODO do all of this in another function, run each rule instead of multiple traversals
        transformRulesRelativeToOutput(rules, unmodifiedCssUrl);
        _focusrAst.markAllRulesAsNoncritical(rules);
        _focusrDom.markMatchingMediaQueriesAsCritical(rules, groupObject);
        if (groupObject["alwaysInclude"].length > 0) {
            for (var i = 0; i < groupObject["alwaysInclude"].length; i++) {
                markAlwaysIncludesAsCritical(rules, groupObject["alwaysInclude"][i]);
            }
        }
        checkIfSelectorsHit(config, groupObject, groupObject["CSSAST"]);
    }
}

function transformRulesRelativeToOutput(rules, unmodifiedCssUrl) {
    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (rule["rules"] !== undefined) {
            transformRulesRelativeToOutput(rule["rules"], unmodifiedCssUrl);
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
                    if (!_focusrHelper.isRemoteUrl(regexResult)) {
                        var newPath = "url(" + prefix + _urlParse.resolve(unmodifiedCssUrl, regexResult) + prefix + ")";
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
                }
            }
        }
    }
}

function checkIfSelectorsHit(config, groupObject, CSSAST) {

    var tmpCssFile = groupObject["baseDir"] + groupObject["outputFile"] + Date.now() + ".txt";
    var viewportW = groupObject["viewport"][0];
    var viewportH = groupObject["viewport"][1];
    var html = groupObject["HTML"];

    var htmlFile = groupObject["baseDir"] + groupObject["outputFile"];
    if (_focusrHelper.isRemoteUrl(groupObject["inputFile"])) {
        htmlFile += ".html";
    }

    _focusrHelper.writeFile(htmlFile, html);
    _focusrHelper.writeFile(tmpCssFile, JSON.stringify(CSSAST));
    _focusrHelper.log(groupObject["groupID"], "Calling PhantomJS");

    var phantomArguments = [_path.join(__dirname, 'phantomJS.js'), htmlFile, tmpCssFile, viewportW, viewportH, config["allowJS"]];
    var execOptions = {
        encoding: 'utf8',
        timeout: config["renderTimeout"],
        killSignal: 'SIGTERM'
    };
    _childProcess.execFile(_phantomJs.path, phantomArguments, execOptions, function (error, output, errorOutput) {
        if (!error) {
            var result = output.trim();
            if (result === "true") {
                _focusrHelper.log(groupObject["groupID"], "PhantomJS reported back");
                var parseError = false;
                var processedAST;
                try {
                    processedAST = JSON.parse(_fileSystem.readFileSync(tmpCssFile, "utf-8"));
                }
                catch (exception) {
                    parseError = true;
                    _focusrHelper.log(groupObject["groupID"], "Error occurred while paring PhantomJS output: " + exception.message, 2);
                }

                if (!parseError) {
                    sliceCss(config, groupObject, processedAST, tmpCssFile);
                }
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "A controlled exception occurred: " + json["errorMessage"] + " " + output, 2);
            }

        }
        else {
            if (output == "") {
                _focusrHelper.log(groupObject["groupID"], "The PhantomJS call timed out after " + config["renderTimeout"] + "ms", 2);
            }
            else {
                _focusrHelper.log(groupObject["groupID"], "A PhantomJS error occurred: " + output + " " + errorOutput, 2);
            }

        }
    });
}

function sliceCss(config, groupObject, processedAST, tmpCssFile) {
    //Deep cloning
    var criticalCssAst = JSON.parse(JSON.stringify(processedAST)), nonCriticalCssAst = JSON.parse(JSON.stringify(processedAST));
    var originalRules = processedAST["stylesheet"]["rules"], criticalRules = criticalCssAst["stylesheet"]["rules"], nonCriticalRules = nonCriticalCssAst["stylesheet"]["rules"];

    for (var i = 0; i < originalRules.length; i++) {
        var rule = originalRules[i];
        if (rule["critical"]) {
            nonCriticalRules[i] = undefined;
        }
        else {
            criticalRules[i] = undefined;
        }
    }

    criticalCssAst["stylesheet"]["rules"] = _focusrHelper.balanceArray(criticalRules);
    nonCriticalCssAst["stylesheet"]["rules"] = _focusrHelper.balanceArray(nonCriticalRules);

    var criticalCss = _reworkCss.stringify(criticalCssAst, {silent: true}), nonCriticalCss = _reworkCss.stringify(nonCriticalCssAst, {silent: true});
    var minifiedCriticalCss = new _cssCleaner().minify(criticalCss).styles, minifiedNonCriticalCss = new _cssCleaner().minify(nonCriticalCss).styles;

    generateResult(config, groupObject, minifiedCriticalCss, minifiedNonCriticalCss, tmpCssFile);
}

function generateResult(config, groupObject, criticalCss, nonCriticalCss, tmpCssFile) {
    _jsDOM.env({
        html: groupObject["HTML"],
        done: function (error, window) {
            if (error) {
                _focusrHelper.log(groupObject["groupID"], "A jsdom error occurred: " + error, 2);
                return;
            }

            var head = window.document.head || window.document.getElementsByTagName('head')[0];
            var body = window.document.body || window.document.getElementsByTagName('body')[0];
            var stylesheets = head.querySelectorAll("link[rel='stylesheet']");

            if (_focusrHelper.isRemoteUrl(groupObject["inputFile"])) {
                if (groupObject["criticalCss"] === undefined) {
                    groupObject["criticalCss"] = "";
                }
                groupObject["criticalCss"] += criticalCss;
                if (groupObject["outputJS"]) {
                    _focusrHelper.writeFile(groupObject["baseDir"] + groupObject["outputJS"], _focusrDom.generateLoadCSSJS(stylesheets));
                    _focusrHelper.log(groupObject["groupID"], "File '" + groupObject["baseDir"] + groupObject["outputJS"] + "' generated", 1);
                }
            }
            else {
                for (var i = 0; i < stylesheets.length; i++) {
                    head.removeChild(stylesheets[i]);
                }
                head.appendChild(_focusrDom.generateStyleTag(window, criticalCss));

                if (config["inlineNonCritical"]) {
                    body.appendChild(_focusrDom.generateStyleTag(window, nonCriticalCss));
                }
                else {
                    var jsForLoadCss = window.document.createElement('script');
                    jsForLoadCss.innerHTML = _focusrDom.generateLoadCSSJS(stylesheets);
                    body.appendChild(jsForLoadCss);
                }
            }
            _focusrHelper.collectGarbage(tmpCssFile, groupObject);
            config["runningGroups"]--;

            if (_focusrHelper.isRemoteUrl(groupObject["inputFile"])) {
                _focusrHelper.writeFile(groupObject["baseDir"] + groupObject["outputFile"], groupObject["criticalCss"]);
            }
            else {
                if (config["debug"]) {
                    body.innerHTML = _focusrDom.insertDebugBox(body, groupObject);
                }
                var resultHTML = window.document.documentElement.outerHTML;
                _focusrHelper.writeFile(groupObject["baseDir"] + groupObject["outputFile"], resultHTML);
            }
            _focusrHelper.log(groupObject["groupID"], "File '" + groupObject["baseDir"] + groupObject["outputFile"] + "' generated", 1);

            printOutroIfNeeded(config);
        }
    });
}

// ----------------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------------

function initialize() {
    _focusrHelper.printIntro();
    parseConfig("config.json");
}

initialize();


//TODO make exports
//exports.focus = focus;


//function focus(baseDir, inputFile, outputFile, baseUrl) {
//    global = extendConfig(defaultConfig, {});
//    var newGroup = extendConfig(defaultGroup, {});
//    newGroup["baseDir"] = baseDir;
//    newGroup["inputFile"] = inputFile;
//    newGroup["outputFile"] = outputFile;
//    newGroup["groupID"] = 0;
//    if (baseUrl !== undefined) {
//        newGroup["baseUrl"] = baseUrl;
//    }
//    global["runningGroups"] = 1;
//    parseGroup(newGroup);
//}
//if (process.argv.length > 2) {
//    if (process.argv.length >= 5) {
//        _focusrHelper.printIntro();
//        focus(process.argv[2], process.argv[3], process.argv[4]);
//    }
//    else {
//        _focusrHelper.printUsage();
//    }
//
//}
//else {
//    _fileSystem.readFile("config.json", 'utf8', function (err, data) {
//        if (!err) {
//            _focusrHelper.printIntro();
//            parseConfig(JSON.parse(data));
//        }
//        else {
//            console.log("Config file can not be opened");
//        }
//    });
//}