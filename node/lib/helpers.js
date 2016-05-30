var colors = require('colors'),
    fs = require('fs'),
    getDirName = require('path').dirname,
    mkdirp = require('mkdirp');

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
    collectGarbage: function (tmpCssFile, groupObject){
        fs.unlink(tmpCssFile);
        var htmlFile = groupObject["baseDir"] + groupObject["outputFile"];
        if (this.isRemoteUrl(groupObject["inputFile"])) {
            htmlFile += ".html";
        }
        fs.unlink(htmlFile);
    },
    endEarly: function (groupObject){
        if(!this.isRemoteUrl(groupObject["inputFile"])) {
            this.writeFile(groupObject["baseDir"] + groupObject["outputFile"], groupObject["HTML"]);
        }
        else{
            this.writeFile(groupObject["baseDir"] + groupObject["outputFile"], "");
        }
    },
    generateLoadCSSJS: function (stylesheets) {
        var linksToLoad = [];
        for (var i = 0; i < stylesheets.length; i++) {
            linksToLoad.push(stylesheets[i].getAttribute("href"))
        }
        return '/* Focusr */ var fl=function(){for(var e=["' + linksToLoad.join('","') + '"],t=0;t<e.length;t++){var n=document.createElement("link");n.rel="stylesheet",n.href=e[t],document.body.appendChild(n)}},raf=requestAnimationFrame||mozRequestAnimationFrame||webkitRequestAnimationFrame||msRequestAnimationFrame;raf?raf(function(){window.setTimeout(fl,0)}):window.addEventListener("load",fl);';
    },
    generateStyleTag: function(window, rules){
        rules += "/* Focusr */ ";
        var criticalStyleTag = window.document.createElement('style');
        criticalStyleTag.type = 'text/css';
        if (criticalStyleTag.styleSheet) {
            criticalStyleTag.styleSheet.cssText = rules;
        } else {
            criticalStyleTag.appendChild(window.document.createTextNode(rules));
        }
        return criticalStyleTag;
    },
    injectAuth: function (url, authenticationData) {
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
    insertDebugBox: function(body){
        return '<div style="border:3px solid red;width:' + groupObject["viewport"][0] + 'px; height:' + groupObject["viewport"][1] + 'px;position:absolute;top:0;left:0;z-index:2147483647"></div>' + body.innerHTML;
    },
    isBaseRelative: function (url) {
        return url.lastIndexOf("/", 0) === 0;
    },
    isRemoteUrl: function (url) {
        return url.indexOf("http://", 0) === 0 || url.indexOf("https://", 0) === 0 || url.indexOf("www.", 0) === 0;
    },
    log: function (groupID, message, messageType) {
        var prefix = "[" + groupID + "] - ";
        if(groupID==-1){
            prefix = "";
        }

        if(messageType == 1){
            console.log(prefix + colors.green(message));
        }
        else if(messageType == 2){
            console.log(prefix + colors.red(message));
        }
        else{
            console.log(prefix + message);
        }
    },
    printIntro: function(){
        this.log(-1, "---------------------");
        this.log(-1, "| Focusr run started |");
        this.log(-1, "---------------------\n");
    },
    printOutro: function(){
        this.log(-1, "\n---------------------");
        this.log(-1, "| Focusr run ended |");
        this.log(-1, "---------------------");
    },
    printUsage: function(){
        this.log(-1, "Focusr usage requires 3 arguments in this order:");
        this.log(-1, "\t" + colors.green("baseDirectory") + " - the directory of the index.html file to work on");
        this.log(-1, "\t" + colors.green("inputFile") + " - the input file relative to the baseDirectory");
        this.log(-1, "\t" + colors.green("outputFile") + " - the output file relative to the baseDirectory");
    },
    writeFile: function (path, contents) {
        mkdirp.sync(getDirName(path));
        fs.writeFileSync(path, contents, {flag: 'w'});

    }
};