module.exports = function (app, express) {
  global.authom = require("@omneedia/authom");

  global.authom.on("error", function (req, res, data) {
    // called when an error occurs during authentication
    console.log("-- ERROR ------");
    console.log(data);
    console.log("---------------");
    // Close the login window
    try {
      res.set("Content-Type", "text/html");
    } catch (e) {}
    res.end(
      "<html><body><script>window.opener.socket.emit('#login_error','" +
        JSON.stringify(data) +
        "');setTimeout(window.close, 1000);</script></body></html>"
    );
  });

  /*
      In here we handle our incoming realtime connections and listen for events.
    */

  global.authom.on("auth", function (req, res, data) {
    var profile = data;
    Auth.officer(req, profile, function (err, response) {
      if (!response) {
        //global.OASocketonFailedAuth(response);
        // Close the login window
        res.set("Content-Type", "text/html");
        res.end(
          "<html><body><script>setTimeout(window.close, 100);</script></body></html>"
        );
        return;
      }

      //JSON.parse(JSON.stringify(response));
      req.session.user = response;

      // Close the login window
      try {
        res.set("Content-Type", "text/html");
      } catch (e) {}

      res.end(
        "<html><body><script>window.opener.socket.transmit('#login','" +
          JSON.stringify(response) +
          "');setTimeout(window.close, 1000);</script></body></html>"
      );
    });
  });

  var fs = require("fs");
  var sep = "/";

  //var util = require('../util');

  // published Officer
  global.officer = require(global.project.auth + sep + "Officer.js");
  if (global.officer.published) global.officer = global.officer.published;

  global.officer = Object.assign(
    global.officer,
    require(__dirname + "/global.js")()
  );
  // Profiles
  global.officer.profiles = {
    getAll: function (cb) {
      fs.readFile(global.project.auth + sep + "Profiler.json", function (e, r) {
        var profiler = JSON.parse(r.toString("utf-8"));
        cb(null, profiler);
      });
    },
    get: function (o, cb) {
      if (!o) cb("NO_PROFILE_ID");
      fs.readFile(global.project.auth + sep + "Profiler.json", function (e, r) {
        var profiler = JSON.parse(r.toString("utf-8"));
        if (profiler.profiles.indexOf(o) == -1) return cb("PROFILE_NOT_FOUND");
        cb(null, profiler.profile[o]);
      });
    },
  };
  global.officer.getProfile = function (user, cb) {
    var response = [];
    if (cb) {
      fs.readFile(global.project.auth + sep + "Profiler.json", function (e, r) {
        var profiler = JSON.parse(r.toString("utf-8"));
        for (var el in profiler.profile) {
          var p = profiler.profile[el];
          if (p.indexOf(user) > -1) response.push(el);
        }
        cb(response);
      });
    }
  };
  global.officer = Object.assign(
    global.officer,
    require(__dirname + "/global.js")()
  );

  global.Auth = {
    officer: function (req, profile, fn) {
      this.register(req, profile, function (err, response) {
        fn(err, response);
      });
    },
    register: function (req, profile, cb) {
      var auth_type = profile.service;
      var off = "Officer";

      var Officer = require(global.project.auth + sep + off + ".js");
      Officer = Object.assign(Officer, require(__dirname + "/global.js")());
      // Profiles
      Officer.profiles = {
        getAll: function (cb) {
          fs.readFile(global.project.auth + sep + "Profiler.json", function (
            e,
            r
          ) {
            var profiler = JSON.parse(r.toString("utf-8"));
            cb(null, profiler);
          });
        },
        get: function (o, cb) {
          if (!o) cb("NO_PROFILE_ID");
          fs.readFile(global.project.auth + sep + "Profiler.json", function (
            e,
            r
          ) {
            var profiler = JSON.parse(r.toString("utf-8"));
            if (profiler.profiles.indexOf(o) == -1)
              return cb("PROFILE_NOT_FOUND");
            cb(null, profiler.profile[o]);
          });
        },
      };
      Officer.getProfile = function (user, cb) {
        var response = [];
        if (cb) {
          fs.readFile(global.project.auth + sep + "Profiler.json", function (
            e,
            r
          ) {
            var profiler = JSON.parse(r.toString("utf-8"));
            for (var el in profiler.profile) {
              var p = profiler.profile[el];
              if (p.indexOf(user) > -1) response.push(el);
            }
            cb(response);
          });
        }
      };
      Officer.login(profile, function (err, response) {
        if (err) return cb(err);
        req.session.authType = auth_type;
        req.session.user = response;
        cb(err, response);
      });
    },
  };

  app.get("/bye", function (req, res) {
    res.setHeader("content-type", "text/html");
    res.end("<script>window.opener.location.reload();window.close();</script>");
  });

  app.post("/pid", function (req, res) {
    var authType = req.session.authType;
    req.session.destroy();
    if (global.settings.auth[authType.toLowerCase()])
      var url = global.settings.auth[authType.toLowerCase()].logout;
    else var url = "/bye";
    return res.redirect(url);
  });

  app.get("/logout", function (req, res) {
    var authType = req.session.authType;
    var url = "/bye";
    req.session.destroy();
    return res.redirect(url);
  });

  function ensureAuthenticated(req, res, next) {
    if (!req.user) req.user = req.session.user;
    if (req.user) return next();
    res.end('{"response":"NOT_LOGIN"}');
  }

  app.get("/account", ensureAuthenticated, function (req, res) {
    if (!req.user) req.user = req.session.user;
    var response = [];
    fs.readFile(global.project.auth + sep + "Profiler.json", function (e, r) {
      if (e) return res.end(JSON.stringify(req.user));
      var profiler = JSON.parse(r.toString("utf-8"));
      for (var el in profiler.profile) {
        var p = profiler.profile[el];
        if (p.indexOf(req.user.mail.split("@")[0]) > -1) response.push(el);
      }
      req.user.profiles = response;
      res.end(JSON.stringify(req.user));
    });
  });

  app.post("/account", ensureAuthenticated, function (req, res) {
    if (!req.user) req.user = req.session.user;
    var response = [];
    fs.readFile(global.project.auth + sep + "Profiler.json", function (e, r) {
      if (e) return res.end(JSON.stringify(req.user));
      var profiler = JSON.parse(r.toString("utf-8"));
      for (var el in profiler.profile) {
        var p = profiler.profile[el];
        if (p.indexOf(req.user.mail.split("@")[0]) > -1) response.push(el);
      }
      req.user.profiles = response;
      res.end(JSON.stringify(req.user));
    });
  });

  for (var el = 0; el < global.settings.auth.length; el++) {
    var o = global.settings.auth[el].login;
    o.service = global.settings.auth[el].type;
    authom.createServer(o);
  }

  app.get("/session", function (req, res) {
    res.end(JSON.stringify(req.session, null, 4));
  });

  app.get("/auth/:service", authom.app);
};
