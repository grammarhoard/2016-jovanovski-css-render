var _request = require('request');

var _focusrHelper = require("./helpers.js");

module.exports = {
    getWordpressGroups: function (global, groupObject, groupID, callback) {
        var wordpressLinksUrl = _focusrHelper.prepUrlAuthentication(groupObject["inputFile"] + "?focusr=links", groupObject["httpAuth"]);
        (function (that) {
            _request(wordpressLinksUrl, function (error, response, responseData) {
                if (!error && response.statusCode === 200) {
                    try {
                        var groups = that.createWordpressGroups(responseData, groupObject, groupID);
                        global["runningGroups"] += groups.length;
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
        }(this));
    },

    createWordpressGroups: function (responseData, groupObject, groupID) {
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
                newGroup["groupID"] = groupID + "." + subgroupID++;
                groups.push(newGroup);
            }
        }
        return groups;
    }
};