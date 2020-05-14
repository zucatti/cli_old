module.exports = function (app, express) {
    var sep = "/";
    var _App = require(global.project.system + sep + "app.js");
    _App = Object.assign(_App, require(__dirname + '/global.js')());

    _App.cors = {
        enable: function () {
            return app.use(require('cors')())
        }
    };

    _App.init(app, express);

}