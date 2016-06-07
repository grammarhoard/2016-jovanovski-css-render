var _urlParse = require("url"),
    _mediaQuery = require('css-mediaquery');

var _focusrHelper = require("./helpers.js");

module.exports = {
    initialPassOnRules: function (rules, unmodifiedCssUrl, groupObject) {
        this.transformRulesRelativeToOutput(rules, unmodifiedCssUrl);
        this.markAllRulesAsNoncritical(rules);
        this.markMatchingMediaQueriesAsCritical(rules, groupObject["viewport"]);
        this.markAlwaysInclude(rules, groupObject["alwaysInclude"]);
    },
    markAllRulesAsNoncritical: function (rules) {
        for (var i = 0; i < rules.length; i++) {
            rules[i]["critical"] = false;
        }
    },
    markAlwaysInclude: function (rules, alwaysIncludeArray) {
        if (alwaysIncludeArray.length > 0) {
            for (var i = 0; i < alwaysIncludeArray.length; i++) {
                this.markAlwaysIncludesAsCritical(rules, alwaysIncludeArray[i]);
            }
        }
    },
    markAlwaysIncludesAsCritical: function (rules, ruleToInclude) {
        var regexPattern = new RegExp(ruleToInclude);
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (rule["rules"] !== undefined) {
                this.markAlwaysIncludesAsCritical(rule["rules"], ruleToInclude);
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
    },
    markMatchingMediaQueriesAsCritical: function (rules, viewport) {
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (rule["type"] === "media") {
                rule["critical"] = this.mediaQueryMatchesViewport(rule["media"], viewport[0], viewport[1]);
            }
        }
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
    }
    ,
    mergeAsts: function (astA, astB) {
        astA["stylesheet"]["rules"] = astA["stylesheet"]["rules"].concat(astB["stylesheet"]["rules"]);
        return astA;
    },
    transformRulesRelativeToOutput: function (rules, unmodifiedCssUrl) {
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (rule["rules"] !== undefined) {
                this.transformRulesRelativeToOutput(rule["rules"], unmodifiedCssUrl);
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
};