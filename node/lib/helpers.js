var _colors = require('colors'),
    _fileSystem = require('fs'),
    _getDirName = require('path').dirname,
    _makeDirPath = require('mkdirp'),
    _path = require('path'),
    _urlParse = require("url");

var defaultConfig = {
        "allowJS": false,
        "debug": false,
        "processExternalCss": true,
        "inlineNonCritical": false,
        "renderTimeout": 60000,
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

module.exports = {
    removeUndefinedRules: function (rules) {
        var definedRules = [];
        for (var i = 0; i < rules.length; i++) {
            if (rules[i] !== undefined) {
                definedRules.push(rules[i]);
            }
        }
        return definedRules;
    },
    deleteFile: function (tmpCssFile) {
        _fileSystem.unlink(tmpCssFile);
    },
    extendDefaultConfig: function (userConfig) {
        return this.extendConfig(defaultConfig, userConfig);
    },
    extendGroupConfig: function (userConfig) {
        return this.extendConfig(defaultGroup, userConfig);
    },
    extendConfig: function (baseConfig, userConfig) {
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
    },
    getLogCountVerb: function (count){
        return count === 1 ? "is" : "are";
    },
    isBaseRelative: function (url) {
        return url.lastIndexOf("/", 0) === 0;
    },
    isRemoteUrl: function (url) {
        return url.indexOf("http://", 0) === 0 || url.indexOf("https://", 0) === 0 || url.indexOf("www.", 0) === 0;
    },
    log: function (groupID, message, messageType) {
        var prefix = "[" + groupID + "] - ";
        if (groupID === -1) {
            prefix = "";
        }

        if (messageType === 1) {
            console.log(prefix + _colors.green(message));
        }
        else if (messageType === 2) {
            console.log(prefix + _colors.red(message));
        }
        else {
            console.log(prefix + message);
        }
    },
    logGroupInfo: function (groups) {
        var totalGroups = 0;
        var wordpressGroups = 0;
        var localGroups = 0;
        var remoteGroups = 0;
        for (var i = 0; i < groups.length; i++) {
            var groupObject = groups[i];
            if(!groupObject["enabled"]){
                continue;
            }

            totalGroups++;
            if(groupObject["wordpress"]){
                wordpressGroups++;
            }
            else if(this.isRemoteUrl(groupObject["inputFile"])){
                remoteGroups++;
            }
            else{
                localGroups++;
            }
        }

        this.log(-1, "Working with a total of " + totalGroups + " groups, of which:");
        if(localGroups){
            this.log(-1, "\t" + localGroups + " " + this.getLogCountVerb(localGroups) + " local input files");
        }
        if(remoteGroups){
            this.log(-1, "\t" + remoteGroups + " " + this.getLogCountVerb(remoteGroups) + " local remote files");
        }
        if(wordpressGroups){
            this.log(-1, "\t" + wordpressGroups + " " + this.getLogCountVerb(wordpressGroups) + " Wordpress");
        }
        this.log(-1, "\n");
    },
    prepCssUrl: function (cssUrl, inputFile, baseUrl) {
        if (cssUrl.indexOf("//") == 0) {
            cssUrl = "http:" + cssUrl;
        }
        if ((this.isRemoteUrl(inputFile) && !this.isRemoteUrl(cssUrl)) || baseUrl !== undefined) {
            if (baseUrl !== undefined) {
                cssUrl = _urlParse.resolve(baseUrl, cssUrl);
            }
            else {
                cssUrl = _urlParse.resolve(inputFile, cssUrl);
            }
        }
        return cssUrl;
    },
    prepUrlAuthentication: function (url, authenticationData) {
        if (authenticationData === "") {
            return url;
        }
        if (url.indexOf("http://", 0) === 0) {
            return url.replace("http://", "http://" + authenticationData + "@");
        }
        else if (url.indexOf("https://", 0) === 0) {
            return url.replace("http://", "https://" + authenticationData + "@");
        }
        else if (url.indexOf("www.", 0) === 0) {
            return url.replace("www.", "http://" + authenticationData + "@www.");
        }
        return url;
    },
    prepLocalUrl: function (url, groupObject) {
        if (this.isBaseRelative(url)) {
            return groupObject["baseDir"] + url.substring(1);
        }
        else {
            return groupObject["baseDir"] + _path.dirname(groupObject["inputFile"]).substring(1) + url;
        }
    },
    printOutroIfNeeded: function (config) {
        if (config["runningGroups"] === 0) {
            this.printOutro();
        }
    },
    printIntro: function () {
        this.log(-1, "---------------------");
        this.log(-1, "| Focusr run started |");
        this.log(-1, "---------------------\n");
    },
    printOutro: function () {
        this.log(-1, "\n---------------------");
        this.log(-1, "| Focusr run ended |");
        this.log(-1, "---------------------");
    },
    printUsage: function () {
        this.log(-1, "Focusr CLI requires 3 arguments in this order:");
        this.log(-1, "\t" + _colors.green("baseDirectory") + " - the directory of the index.html file to work on");
        this.log(-1, "\t" + _colors.green("inputFile") + " - the input file relative to the baseDirectory");
        this.log(-1, "\t" + _colors.green("outputFile") + " - the output file relative to the baseDirectory");
    },
    writeFile: function (path, contents, shouldOutputToLog, groupID) {
        _makeDirPath.sync(_getDirName(path));
        _fileSystem.writeFileSync(path, contents, {flag: 'w'});
        if (shouldOutputToLog !== undefined && shouldOutputToLog) {
            this.log(groupID, "File '" + path + "' generated", 1);
        }
    }
};