var colors = require('colors'),
    fs = require('fs'),
    getDirName = require('path').dirname,
    mkdirp = require('mkdirp');

module.exports = {
    intro: function(){
        console.log(colors.white("---------------------"));
        console.log(colors.white("|") + " Focusr run stared " + colors.white("|"));
        console.log(colors.white("---------------------\n"));
    },
    outro: function(){
        console.log(colors.white("\n---------------------"));
        console.log(colors.white("|") + " Focusr run ended " + colors.white("|"));
        console.log(colors.white("---------------------"));
    },
    collectGarbage: function (groupObject, tmpCssFile){
        fs.unlink(tmpCssFile);

        var htmlFile = groupObject["baseDir"] + groupObject["outputFile"];
        if (this.isRemoteUrl(groupObject["inputFile"])) {
            htmlFile += ".html";
        }
        fs.unlink(htmlFile);
    },
    generateStyleTag: function(window, rules){
        var criticalStyleTag = window.document.createElement('style');
        criticalStyleTag.type = 'text/css';
        if (criticalStyleTag.styleSheet) {
            criticalStyleTag.styleSheet.cssText = rules;
        } else {
            criticalStyleTag.appendChild(window.document.createTextNode(rules));
        }
        return criticalStyleTag;
    },
    insertDebugBox: function(body){
        return '<div style="border:3px solid red;width:' + groupObject["viewport"][0] + 'px; height:' + groupObject["viewport"][1] + 'px;position:absolute;top:0;left:0;z-index:2147483647"></div>' + body.innerHTML;
    },
    logMessage: function (groupID, message, messageType) {
        if(messageType == 1){
            console.log(colors.green("[" + groupID + "] - " + message));
        }
        else if(messageType == 2){
            console.log(colors.red("[" + groupID + "] - " + message));
        }
        else{
            console.log("[" + groupID + "] - " + message);
        }
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
    isRemoteUrl: function (url) {
        return url.indexOf("http://", 0) === 0 || url.indexOf("https://", 0) === 0 || url.indexOf("www.", 0) === 0;
    },

    isBaseRelative: function (url) {
        return url.lastIndexOf("/", 0) === 0;
    },

    balanceArray: function (array) {
        var tmpArray = [];
        for (var i = 0; i < array.length; i++) {
            if (array[i] !== undefined) {
                tmpArray.push(array[i]);
            }
        }
        return tmpArray;
    },
    generateLoadCSSJS: function (stylesheets) {
        var linksToLoad = [];
        for (var i = 0; i < stylesheets.length; i++) {
            linksToLoad.push(stylesheets[i].getAttribute("href"))
        }
        return 'var fl=function(){for(var e=["' + linksToLoad.join('","') + '"],t=0;t<e.length;t++){var n=document.createElement("link");n.rel="stylesheet",n.href=e[t],document.body.appendChild(n)}},raf=requestAnimationFrame||mozRequestAnimationFrame||webkitRequestAnimationFrame||msRequestAnimationFrame;raf?raf(function(){window.setTimeout(fl,0)}):window.addEventListener("load",fl);';
    },

    writeFile: function (path, contents) {
        mkdirp.sync(getDirName(path));
        fs.writeFileSync(path, contents, {flag: 'w'});

    }
};