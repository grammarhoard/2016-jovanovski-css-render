var _colors = require('colors'),
    _fileSystem = require('fs'),
    _getDirName = require('path').dirname,
    _makeDirPath = require('mkdirp'),
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
    balanceArray: function (array) {
        var tmpArray = [];
        for (var i = 0; i < array.length; i++) {
            if (array[i] !== undefined) {
                tmpArray.push(array[i]);
            }
        }
        return tmpArray;
    },
    collectGarbage: function (tmpCssFile, groupObject) {
        _fileSystem.unlink(tmpCssFile);
        var htmlFile = groupObject["baseDir"] + groupObject["outputFile"];
        if (this.isRemoteUrl(groupObject["inputFile"])) {
            htmlFile += ".html";
        }
        _fileSystem.unlink(htmlFile);
    },
    extendDefaultConfig: function(userConfig){
        return this.extendConfig(defaultConfig, userConfig);
    },
    extendGroupConfig: function(userConfig){
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
    isBaseRelative: function (url) {
        return url.lastIndexOf("/", 0) === 0;
    },
    isRemoteUrl: function (url) {
        return url.indexOf("http://", 0) === 0 || url.indexOf("https://", 0) === 0 || url.indexOf("www.", 0) === 0;
    },
    log: function (groupID, message, messageType) {
        var prefix = "[" + groupID + "] - ";
        if (groupID == -1) {
            prefix = "";
        }

        if (messageType == 1) {
            console.log(prefix + _colors.green(message));
        }
        else if (messageType == 2) {
            console.log(prefix + _colors.red(message));
        }
        else {
            console.log(prefix + message);
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
        this.log(-1, "Focusr usage requires 3 arguments in this order:");
        this.log(-1, "\t" + _colors.green("baseDirectory") + " - the directory of the index.html file to work on");
        this.log(-1, "\t" + _colors.green("inputFile") + " - the input file relative to the baseDirectory");
        this.log(-1, "\t" + _colors.green("outputFile") + " - the output file relative to the baseDirectory");
    },
    writeFile: function (path, contents) {
        _makeDirPath.sync(_getDirName(path));
        _fileSystem.writeFileSync(path, contents, {flag: 'w'});

    }
};