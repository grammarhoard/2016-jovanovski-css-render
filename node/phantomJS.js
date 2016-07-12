var _page = require('webpage').create(),
    _system = require('system'),
    _fileSystem = require('fs');

function applyPhantomJsSetting(viewportWidth, viewportHeight) {
    _page.viewportSize = {
        width: viewportWidth,
        height: viewportHeight
    };
    _page.settings.resourceTimeout = 3000;
    _page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36';
    _page.settings.webSecurityEnabled = false;
    _page.onError = function(msg, trace) {
        //ignore JS errors
    };
    _page.onLoadStarted = function () {
        _page.navigationLocked = true;
    };
}

function generateCssAst(tmpCssPath) {
    var tmpCssFile = _fileSystem.open(tmpCssPath, 'r');
    try {
        var cssAst = JSON.parse(tmpCssFile.read());
    }
    catch (exception) {
        console.log("Expection reading file and parsing with JSON! " + tmpCssFile)
    }
    tmpCssFile.close();
    return cssAst;
}

function runPhantomJs(htmlPath, tmpCssPath, viewportWidth, viewportHeight){
    _page.open(htmlPath, function () {
        var cssAst = generateCssAst(tmpCssPath);
        var criticalHits = _page.evaluate(function (cssAst, viewportWidth, viewportHeight) {

            function focusr_isElementInViewport(element, viewportWidth, viewportHeight) {
                return (element !== undefined && element.getBoundingClientRect() !== undefined && element.getBoundingClientRect().top < viewportHeight && element.getBoundingClientRect().left < viewportWidth);
            }

            function focusr_getElementsFromDom(window, selector) {
                try {
                    return window.document.querySelectorAll(selector);
                }
                catch (e) {
                    return [];
                }
            }

            function focusr_isAtRule(selector, rule) {
                if (selector.indexOf("@") === 0) {
                    rule["critical"] = false;
                    return true;
                }
                return false;
            }

            function focusr_removePseudoSelector(selector) {
                if (selector.indexOf(":") != -1) {
                    selector = selector.substring(0, selector.indexOf(":"));
                }
                return selector;
            }

            function focusr_processRule(rule, viewportWidth, viewportHeight) {
                for (var i = 0; i < rule["selectors"].length; i++) {
                    var selector = rule["selectors"][i];
                    selector = focusr_removePseudoSelector(selector);

                    if (focusr_isAtRule(selector, rule)) {
                        continue;
                    }

                    var elements = focusr_getElementsFromDom(window, selector);
                    var foundElementInViewport = false;
                    for (var j = 0; j < elements.length; j++) {
                        var element = elements[j];
                        if (focusr_isElementInViewport(element, viewportWidth, viewportHeight)) {
                            foundElementInViewport = true;
                            break;
                        }
                    }
                    if (foundElementInViewport) {
                        rule["critical"] = true;
                        break;
                    }
                }
            }

            function focusr_processRules() {
                for (var i = 0; i < cssAst["stylesheet"]["rules"].length; i++) {
                    var rule = cssAst["stylesheet"]["rules"][i];
                    if (!rule["critical"] && rule["type"] === "rule") {
                        focusr_processRule(rule, viewportWidth, viewportHeight);
                    }
                }
            }
            focusr_processRules();

            return cssAst;
        }, cssAst, viewportWidth, viewportHeight);

        _fileSystem.write(tmpCssPath, JSON.stringify(criticalHits), 'w');
        console.log("success");
        phantom.exit();
    });
}

function initialize(){
    var htmlPath = _system.args[1],
        tmpCssPath = _system.args[2],
        viewportWidth = _system.args[3],
        viewportHeight = _system.args[4];
    applyPhantomJsSetting(viewportWidth, viewportHeight);
    runPhantomJs(htmlPath, tmpCssPath, viewportWidth, viewportHeight);
}

initialize();
