module.exports = function (args, root) {
    var opn = require('open');
    var browser = {};

    if (global.config.browser) {
        var b = global.config.browser.default;
        // a écrire et a tester pour windows et linux... Les racourcis ne sont pas les mêmes.
        if (b == "canary") browser.app = "google chrome canary";
        if (b == "google") browser.app = "google chrome";
        if (b == "chrome") browser.app = "google chrome";
        if (b == "safari") browser.app = "safari";
        if (b == "opera") browser.app = "opera";
        if (b == "firefoxdev") browser.app = "firefox developer edition";
    };

    opn('https://docs.omneedia.com', {
        app: browser.app
    });

}