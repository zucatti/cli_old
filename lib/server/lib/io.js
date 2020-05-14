module.exports = function (socket, app, express, agServer, ENVIRONMENT) {
  var fs = require("fs");

  fs.readdir(__dirname + "/io", function (e, d) {
    if (e) return;
    for (var i = 0; i < d.length; i++)
      require(__dirname + "/io/" + d[i])(
        socket,
        app,
        express,
        agServer,
        ENVIRONMENT
      );
    fs.readdir(global.project.io, function (e, d) {
      if (e) return;
      for (var i = 0; i < d.length; i++)
        require(global.project.io + "/" + d[i])(
          socket,
          app,
          express,
          agServer,
          ENVIRONMENT
        );
    });
  });
};
