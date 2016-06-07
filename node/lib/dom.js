var _mediaQuery = require('css-mediaquery');

var _focusrHelper = require("./helpers.js");

module.exports = {
    generateStyleTag: function (window, rules) {
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
    generateLoadCSSJS: function (stylesheets) {
        var linksToLoad = [];
        for (var i = 0; i < stylesheets.length; i++) {
            linksToLoad.push(stylesheets[i].getAttribute("href"))
        }
        return '/* Focusr */ var fl=function(){for(var e=["' + linksToLoad.join('","') + '"],t=0;t<e.length;t++){var n=document.createElement("link");n.rel="stylesheet",n.href=e[t],document.body.appendChild(n)}},raf=requestAnimationFrame||mozRequestAnimationFrame||webkitRequestAnimationFrame||msRequestAnimationFrame;raf?raf(function(){window.setTimeout(fl,0)}):window.addEventListener("load",fl);';
    },
    insertDebugBox: function (body, groupObject) {
        return '<div style="border:3px solid red;width:' + groupObject["viewport"][0] + 'px; height:' + groupObject["viewport"][1] + 'px;position:absolute;top:0;left:0;z-index:2147483647"></div>' + body.innerHTML;
    },
    saveBaseTagIfPresent: function (groupObject, window) {
        var base = window.document.head.querySelectorAll("base");
        if (base.length > 0) {
            groupObject["baseUrl"] = base[0].getAttribute("href");
        }
        return window;
    },
    mediaQueryMatchesViewport: function (mediaQuery, width, height) {
        try {
            return _mediaQuery.match(mediaQuery, {
                width: width + 'px',
                height: height + 'px',
                type: 'screen'
            });
        }
        catch (exception) {
            _focusrHelper.log(-1, "Bad media query: '" + mediaQuery + "'", 2);
            return false;
        }
    },
    markMatchingMediaQueriesAsCritical: function (rules, groupObject) {
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (rule["type"] === "media") {
                rule["critical"] = this.mediaQueryMatchesViewport(rule["media"], groupObject["viewport"][0], groupObject["viewport"][1]);
            }
        }
    }
};