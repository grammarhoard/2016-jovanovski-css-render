var page = require('webpage').create(),
    system = require('system'),
    fs = require('fs'),
    htmlUrl = system.args[1],
    tmpCssUrl = system.args[1],
    viewportWidth = system.args[3],
    viewportHeight = system.args[4],
    jsEnabled = system.args[5];

page.onConsoleMessage = function (msg) {
    fs.write("log.txt", msg, 'w');
};
page.viewportSize = {
    width: viewportWidth,
    height: viewportHeight
};
page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36';
page.settings.javascriptEnabled = jsEnabled;
page.settings.webSecurityEnabled = false;
page.onLoadStarted = function() {
    page.navigationLocked = true;
};
page.open(htmlUrl, function () {
    var hitElements = {success: "true"};
    var tmpCssFile = fs.open(system.args[2], 'r');
    var cssAst = JSON.parse(tmpCssFile.read());
    tmpCssFile.close();
    hitElements["hits"] = page.evaluate(function (cssAst, viewportWidth, viewportHeight) {
        for (var i = 0; i < cssAst["stylesheet"]["rules"].length; i++) {
            var rule = cssAst["stylesheet"]["rules"][i];
            if (!rule["critical"]) {
                if (rule["type"] === "rule") {
                    var ruleHit = false;
                    for (var j = 0; j < rule["selectors"].length; j++) {
                        var selector = rule["selectors"][j];
                        // Nasty fix for @-ms-viewport
                        if (selector.indexOf("@") === 0) {
                            continue;
                        }

                        // Clean off pseudo stuff
                        if (selector.indexOf(":") != -1) {
                            selector = selector.substring(0, selector.indexOf(":"));
                        }

                        var elements;
                        try {
                            elements = window.document.querySelectorAll(selector);
                        }
                        catch (e) {
                            continue;
                        }
                        var hit = false;
                        for (var k = 0; k < elements.length; k++) {
                            var element = elements[k];
                            if (element !== undefined && element.getBoundingClientRect() !== undefined && element.getBoundingClientRect().top < viewportHeight && element.getBoundingClientRect().left < viewportWidth) {
                                hit = true;
                                break;
                            }
                        }
                        if (hit) {
                            ruleHit = true;
                            break;
                        }
                    }
                    rule["critical"] = ruleHit;
                }
                else if (rule["type"] === "font-face") {
                    rule["critical"] = false;
                }
            }
        }

        return cssAst;
    }, cssAst, viewportWidth, viewportHeight);
    fs.write(tmpCssUrl, JSON.stringify(hitElements["hits"]), 'w');
    console.log(hitElements["success"]);
    phantom.exit();
});

