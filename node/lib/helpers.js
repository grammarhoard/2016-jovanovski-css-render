var colors = require('colors'),
    fs = require('fs'),
    getDirName = require('path').dirname,
    mkdirp = require('mkdirp');

module.exports = {
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