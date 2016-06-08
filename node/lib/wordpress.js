var _request = require('request');

var _focusrHelper = require("./helpers.js");

module.exports = {
    getWordpressGroups: function (global, groupObject, callback) {
        _focusrHelper.log(groupObject["groupID"], "Hey, a Wordpress site, trying to contact the Focusr plugin...");
        var wordpressLinksUrl = _focusrHelper.prepUrlAuthentication(groupObject["inputFile"] + "?focusr=links", groupObject["httpAuth"]);
        (function (that, groupObject) {
            _request(wordpressLinksUrl, function (error, response, responseData) {
                if (!error && response.statusCode === 200) {
                    try {
                        var groups = that.createWordpressGroups(responseData, groupObject);
                        global["runningGroups"] += groups.length;
                        _focusrHelper.log(groupObject["groupID"], "Focusr Wordpress plugin responded successfully!", 1);
                        callback(groups);
                    }
                    catch (exception) {
                        _focusrHelper.log(groupObject["groupID"], "Bad response from WordPress URL " + groupObject["inputFile"] + ": " + exception.message, 2);
                    }
                }
                else {
                    _focusrHelper.log(groupObject["groupID"], "Error fetching links from WordPress URL " + groupObject["inputFile"], 2);
                }
            });
        }(this, groupObject));
    },

    createWordpressGroups: function (responseData, groupObject) {
        var groups = [];
        var links = JSON.parse(responseData);
        var subgroupID = 1;
        for (var key in links) {
            if (links.hasOwnProperty(key)) {
                var newGroup = _focusrHelper.extendGroupConfig(groupObject);
                newGroup["wordpress"] = false;
                newGroup["inputFile"] = links[key] + "?focusr=disable";
                newGroup["outputFile"] = key + ".css";
                newGroup["outputJS"] = key + ".js";
                newGroup["groupID"] = groupObject["groupID"] + "." + subgroupID++;
                groups.push(newGroup);
            }
        }
        return groups;
    }
};