module.exports = {
    markAllRulesAsNoncritical: function (rules) {
        for (var i = 0; i < rules.length; i++) {
            rules[i]["critical"] = false;
        }
    }
};