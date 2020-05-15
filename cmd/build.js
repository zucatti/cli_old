module.exports = function (args, root) {
  var error = require("../lib/utils/error");
  var updateApp = require("../lib/update-app");
  global.project = {
    home: global.dir + "/src",
  };
  global.project.bin = global.dir + "/bin";
  global.project.api = global.project.home + "/services";
  global.project.res = global.project.home + "/resources";
  global.project.culture = global.project.home + "/culture";
  global.project.auth = global.project.home + "/auth";
  global.project.system = global.project.home + "/system";
  global.project.io = global.project.home + "/io";
  var sep = "/";

  var url_modules =
    "https://gitlab.com/api/v4/groups/oa-registry/projects?perpage=100";
  var oa_registry_url = "https://gitlab.com/oa-registry/";
  var findUp = require("find-up");
  var prettyjson = require("prettyjson");
  var shelljs = require("shelljs");
  var logSymbols = require("log-symbols");
  var esprima = require("esprima");
  var chalk = require("chalk");
  const fs = require("fs");
  const path = require("path");
  var boxen = require("boxen");
  var yaml = require("yaml");
  var error = require("../lib/utils/error");
  var stripCssComments = require("strip-css-comments");
  var rmdir = require("rimraf");
  var UglifyCSS = require("uglifycss");
  var UglifyJS = require("terser");
  const ora = require("ora");
  var unzip = require("unzip-stream");
  var rimraf = require("rimraf");

  var langs;
  var LANG = [];
  var streamJS;
  var CSSStream;

  var walk = function (dir, done) {
    var results = [];
    fs.readdir(dir, function (err, list) {
      if (err) return done(err);
      var i = 0;
      (function next() {
        var file = list[i++];
        if (!file) return done(null, results);
        file = require("path").resolve(dir, file);
        fs.stat(file, function (err, stat) {
          if (stat && stat.isDirectory()) {
            walk(file, function (err, res) {
              results = results.concat(res);
              next();
            });
          } else {
            results.push(file);
            next();
          }
        });
      })();
    });
  };

  function process_i18n(cb) {
    var i18n_dir = global.rootdir + "/src/culture";
    var CSS = [];
    function update_langs(langs, ndx) {
      if (!langs[ndx]) return cb();
      var lang = langs[ndx].split(".")[0];
      fs.readFile(i18n_dir + "/" + lang + ".yaml", function (e, r) {
        if (e) return update_langs(langs, ndx + 1, cb);
        var spinner = ora("processing lang: " + chalk.bold(langs[ndx]));
        var l = yaml.parse(r.toString("utf-8"));
        for (var el in l) {
          CSSStream.write(
            ":lang(" +
              lang +
              ")." +
              el +
              ":before { content: '" +
              l[el].replace(/'/g, "\\'") +
              "' }"
          );
        }
        spinner.succeed("processed lang: " + chalk.bold(langs[ndx]));
        update_langs(langs, ndx + 1, cb);
      });
    }
    fs.readdir(i18n_dir, function (e, langs) {
      if (e) return error("i18n culture directory not found");
      update_langs(langs, 0);
    });
  }

  function process_resources(cb) {
    var CSS = [];
    var assets = [];
    var IM = require("jimp");

    function mktpl(texto) {
      var dot = require("dot-prop");

      var item = texto.split("{{");
      for (var i = 0; i < item.length; i++) {
        if (item[i].indexOf("}}") > -1) {
          var obj = item[i].substr(0, item[i].indexOf("}}"));
          var o = eval("global." + obj.split(".")[0]);
          var dots = obj.substr(obj.indexOf(".") + 1, obj.length);
          item[i] =
            dot.get(o, dots) +
            item[i].substr(item[i].lastIndexOf("}}") + 2, item[i].length);
        }
      }

      return item.join("");
    }

    function img(x, i, cb) {
      if (!x[i]) return cb();
      IM.read(global.rootdir + "/" + x[i].src, function (err, IMG) {
        if (err) throw err;
        if (x[i].transform.resize) {
          var values = x[i].transform["resize"].split(",");
          IMG.resize(values[0] * 1, values[1] * 1).getBase64(
            IM.MIME_PNG,
            function (err, src) {
              if (err) throw err;
              assets["/" + x[i].dest] = src;
              img(x, i + 1, cb);
            }
          );
        }
      });
    }
    var dist = global.rootdir + "/bin/omneedia_modules/dist/";
    CSSStream = fs.createWriteStream(
      global.rootdir + "/dist/www/resources.css",
      {
        flags: "a",
        encoding: null,
        mode: 0666,
      }
    );

    function loadBase64Image(ITEMS, len, cb, i) {
      if (!i) i = 0;
      if (i == len) return cb(ITEMS);
      var cp = 0;
      var item = "";
      var el = "";
      for (var elx in ITEMS) {
        if (cp == i) {
          el = elx;
          item = ITEMS[elx];
        }
        cp++;
      }
      console.log(
        "  [" +
          (i + 1) +
          "/" +
          len +
          "]\t" +
          chalk.bold(" adding asset \t(" + path.basename(item) + ")")
      );
      if (item.indexOf("://") == -1) {
        fs.readFile(item, function (e, body) {
          if (body) {
            var base64prefix = "data:" + getMIME(item) + ";base64,",
              image = body.toString("base64");
            ITEMS[el] = base64prefix + image;
          } else {
            if (assets[item]) {
              //var base64prefix = "data:" + getMIME(item) + ";base64,",
              var image = assets[item];
              ITEMS[el] = image;
            } else {
              //console.log(chalk.red.bold("! not found"));
              ITEMS[el] = "";
            }
          }

          loadBase64Image(ITEMS, len, cb, i + 1);
        });
      } else {
        request(
          {
            url: item,
            encoding: null,
            gzip: true,
          },
          function (err, res, body) {
            if (!err && res.statusCode == 200) {
              // So as encoding set to null then request body became Buffer object
              var base64prefix =
                  "data:" + res.headers["content-type"] + ";base64,",
                image = body.toString("base64");
              ITEMS[el] = base64prefix + image + "";
            } else {
              ITEMS[el] = "";
            }

            loadBase64Image(ITEMS, len, cb, i + 1);
          }
        );
      }
    }

    function getMIME(filename) {
      if (filename.indexOf(".gif") > -1) return "image/gif";
      if (filename.indexOf(".jpg") > -1) return "image/jpeg";
      if (filename.indexOf(".png") > -1) return "image/png";
      if (filename.indexOf(".eot") > -1) return "application/vnd.ms-fontobject";
      if (filename.indexOf(".woff") > -1) return "application/font-woff";
      if (filename.indexOf(".woff2") > -1) return "application/font-woff2";
      if (filename.indexOf(".ttf") > -1) return "application/font-ttf";
      if (filename.indexOf(".svg") > -1) return "image/svg+xml";
    }

    function compileCSS(body, cb, durl) {
      CSS = [];
      console.log(
        "  processing: " + durl.substr(durl.lastIndexOf("/") + 1, durl.length)
      );
      // remote content
      /*var durl = url.lastIndexOf("/");
      durl = url.substr(0, durl);*/
      var result = body.split("url(");
      var o = [];
      o[0] = "-1";
      if (body == "\n") return cb();
      if (body == "") return cb();
      var prefix = result[0];

      var ITEMS = {};

      for (var i = 1; i < result.length; i++) {
        var tt = result[i].indexOf(")");
        var test = result[i].substr(0, tt).split("?")[0];
        test = test.replace(/["']/g, "");
        var type = test.lastIndexOf(".");
        var type = test.substr(type + 1, test.length).toLowerCase();
        if (
          type == "gif" ||
          type == "jpg" ||
          type == "png" ||
          type == "eot" ||
          type == "ttf" ||
          type == "woff" ||
          type == "woff2" ||
          type == "svg"
        ) {
          o.push(durl + "/" + test);
          ITEMS[test] = durl + "/" + test;
        } else {
          o.push("-1");
        }
      }

      var len = 0;
      for (var el in ITEMS) {
        len++;
      }

      loadBase64Image(ITEMS, len, function (ITEMS) {
        var text = body;

        for (var el in ITEMS) {
          var re = new RegExp(el, "g");
          text = text.replace(re, ITEMS[el]);
        }

        var css = stripCssComments(text, {
          preserve: false,
        });

        css = UglifyCSS.processString(css);
        CSSStream.write(css);

        cb();
      });
    }

    function loadcss(css, ndx, cbz) {
      if (!css[ndx]) return cbz();
      var lpath;
      if (css[ndx].indexOf("/dist/") > -1) {
        var texto = css[ndx].split(
          global.rootdir + "/bin/omneedia_modules/dist/"
        )[1];
        texto = texto.substr(0, texto.lastIndexOf("/"));
        texto = texto.replace("/", ":");
      } else {
        var texto = css[ndx].split(global.rootdir + "/src/resources/")[1];
      }
      if (css[ndx].substr(0, 1) == "!") {
        var spinner = ora("processing resource: " + chalk.bold(texto));
        var filename = css[ndx].substr(1, css[ndx].length);

        fs.readFile(filename, "utf-8", function (e, r) {
          if (e) return error("css <" + filename + "> not found");
          compileCSS(
            r,
            function () {
              spinner.succeed("processed resource: " + chalk.bold(texto));
              loadcss(css, ndx + 1, cbz);
            },
            require("path").dirname(filename)
          );
        });
      } else {
        var spinner = ora("adding resource: " + chalk.bold(texto));
        fs.readFile(css[ndx], "utf-8", function (e, r) {
          if (e)
            return error(
              "css <" + require("path").basename(css[ndx]) + "> not found"
            );
          CSSStream.write(r);
          spinner.succeed("added resource: " + chalk.bold(texto));
          loadcss(css, ndx + 1, cbz);
        });
      }
    }
    var modules = global.manifest.modules;
    var css = [];
    for (var i = 0; i < modules.length; i++) {
      var item = modules[i];
      if (typeof item == "string") {
        css.push(dist + item.replace(":", "/") + "/resources.css");
      } else {
        // object
        var params = [];
        for (var el in item) {
          if (el != "src") {
            if (typeof item[el] == "string") params.push(el);
          }
        }

        for (var k = 0; k < item.src.length; k++) {
          var mod = item.src[k];
          for (var j = 0; j < params.length; j++) {
            var replace = "{" + params[j] + "}";
            var re = new RegExp(replace, "g");
            mod = mod.replace(re, item[params[j]]);
          }
          if (mod.indexOf(".css") > -1) css.push("!" + dist + mod);
        }
      }
    }

    var spin = ora("preparing assets");

    fs.readFile(global.rootdir + "/.template/assets.json", function (e, tpl) {
      if (e) return error("template not found");

      var tpl = mktpl(tpl.toString("utf-8"));
      tpl = JSON.parse(tpl);

      // prepare image
      img(tpl, 0, function () {
        spin.succeed("assets loaded.");
        fs.readdir(global.rootdir + "/src/resources", function (e, d) {
          if (d) {
            for (var i = 0; i < d.length; i++) {
              if (d[i].indexOf(".css") > -1)
                css.push("!" + global.rootdir + "/src/resources/" + d[i]);
            }
          }
          loadcss(css, 0, cb);
        });
      });
    });
  }

  function process_services(cb) {
    var fs = require("fs");
    var path = require("path");

    var result = [];

    var IS_EXTJS = 0;

    function register_service(API, i, cb) {
      if (!API[i]) return cb();

      if (API[i] == "__QUERY__") {
        var spinner = ora("registering api: " + chalk.bold("query engine"));
        result.push(
          "if (Ext.syncRequire) Ext.syncRequire('Ext.direct.Manager');Ext.namespace('App');"
        );
        var REMOTE_API = {};
        REMOTE_API.url = "/api";
        REMOTE_API.type = "remoting";
        REMOTE_API.namespace = "App";
        REMOTE_API.descriptor = "App.REMOTING_API";
        REMOTE_API.actions = {};
        REMOTE_API.actions["__QUERY__"] = [];
        REMOTE_API.actions["__QUERY__"].push({
          name: "exec",
          len: 1,
        });
        REMOTE_API.actions["__QUERY__"].push({
          name: "post",
          len: 3,
        });
        REMOTE_API.actions["__QUERY__"].push({
          name: "del",
          len: 3,
        });
        REMOTE_API.headers = {
          z: "%FINGERPRINT%",
        };

        var str =
          "if (Ext.syncRequire) Ext.syncRequire('Ext.direct.Manager');Ext.namespace('App');";
        str +=
          "App.REMOTING_API=" +
          JSON.stringify(REMOTE_API, null).replace(
            /"%FINGERPRINT%"/g,
            "window.z"
          ) +
          ";";
        str += "Ext.Direct.addProvider(App.REMOTING_API);";

        /*if (config.remote_api)
          str = str.replace(
            'App.REMOTING_API={"url":"',
            'App.REMOTING_API={"url":"' + config.remote_api
          );
        else*/
        str = str.replace(
          'App.REMOTING_API={"url":"',
          'App.REMOTING_API={"url":document.location.origin+"'
        );
        result.push(str);
        spinner.succeed("registered api: " + chalk.bold("query engine"));
        register_service(API, i + 1, cb);
      } else {
        var REMOTE_API = {};
        REMOTE_API.url = "/api";
        REMOTE_API.type = "remoting";
        REMOTE_API.namespace = "App";
        REMOTE_API.descriptor = "App.REMOTING_API";
        REMOTE_API.actions = {};
        REMOTE_API.actions[API[i]] = [];
        var spinner = ora("registering api: " + chalk.bold(API[i])).start();
        fs.stat(global.project.api + path.sep + API[i] + ".js", function (
          e,
          r
        ) {
          if (e) spinner.fail("registering api: " + chalk.bold(API[i]));
          var _api = require(global.project.api + path.sep + API[i] + ".js");
          for (var e in _api) {
            if (_api[e].toString().substr(0, 8) == "function") {
              var obj = {};
              obj.name = e;
              var myfn = _api[e]
                .toString()
                .split("function")[1]
                .split("{")[0]
                .trim()
                .split("(")[1]
                .split(")")[0]
                .split(",");
              obj.len = myfn.length - 1;
              REMOTE_API.actions[API[i]][
                REMOTE_API.actions[API[i]].length
              ] = obj;
            }
          }
          REMOTE_API.headers = {
            z: "%FINGERPRINT%",
          };
          var str =
            "if (Ext.syncRequire) Ext.syncRequire('Ext.direct.Manager');Ext.namespace('App');";
          str +=
            "App.REMOTING_API=" +
            JSON.stringify(REMOTE_API, null).replace(
              /"%FINGERPRINT%"/g,
              "window.z"
            ) +
            ";";
          str += "Ext.Direct.addProvider(App.REMOTING_API);";
          /*if (config.remote_api)
            str = str.replace(
              'App.REMOTING_API={"url":"',
              'App.REMOTING_API={"url":"' + config.remote_api
            );
          else*/
          str = str.replace(
            'App.REMOTING_API={"url":"',
            'App.REMOTING_API={"url":document.location.origin+"'
          );
          result.push(str);
          spinner.succeed("registered api: " + chalk.bold(API[i]));
          register_service(API, i + 1, cb);
        });
      }
    }
    return fs.readdir(global.project.api, function (e, r) {
      if (e) return error("api not found");
      for (var i = 0; i < r.length; i++)
        r[i] = r[i].substr(0, r[i].lastIndexOf("."));
      r.push("__QUERY__");
      register_service(r, 0, function () {
        streamJS.write(result.join(""));
        cb();
      });
    });
  }

  function process_mvc(cb) {
    var fs = require("fs");
    var path = require("path");
    var workspace = global.project.home + "/app/";

    var GVIEW = [];

    streamJS.write("__MVC__=function() {};\n");

    function process_models(model, i, cb) {
      if (!model) return cb();
      if (!model[i]) return cb();
      var spinner = ora("processing model: " + chalk.bold(model[i])).start();
      fs.readFile(
        workspace +
          "model" +
          path.sep +
          model[i].replace(/\./g, path.sep) +
          ".js",
        function (e, r) {
          if (e) return spinner.fail("model <" + store[i] + "> not found");

          var r = UglifyJS.minify(r.toString("utf-8") + "\n");
          if (!r.code) {
            spinner.fail(" model: " + chalk.red.bold(model[i]));
            return error(r.error);
          }
          streamJS.write(r.code);
          spinner.succeed("processed model: " + chalk.bold(model[i]));

          process_models(model, i + 1, cb);
        }
      );
    }

    function process_stores(store, i, cb) {
      if (!store) return cb();
      if (!store[i]) return cb();
      var spinner = ora("processing store: " + chalk.bold(store[i])).start();
      fs.readFile(
        workspace +
          "store" +
          path.sep +
          store[i].replace(/\./g, path.sep) +
          ".js",
        function (e, r) {
          if (e) return spinner.fail("store <" + store[i] + "> not found");
          var r = UglifyJS.minify(r.toString("utf-8") + "\n");
          if (!r.code) {
            spinner.fail(" store: " + chalk.red.bold(store[i]));
            return error(r.error);
          }
          streamJS.write(r.code);
          spinner.succeed("processed store: " + chalk.bold(store[i]));
          process_stores(store, i + 1, cb);
        }
      );
    }

    function process_views(views, i, cb) {
      if (!views) return cb();
      if (!views[i]) return cb();

      function nextView() {
        if (GVIEW.indexOf(views[i]) > -1)
          return process_views(views, i + 1, cb);
        var spinner = ora("processing view: " + chalk.bold(views[i])).start();
        fs.readFile(
          workspace + "view/" + views[i].replace(/\./g, path.sep) + ".js",
          function (e, r) {
            if (e) return spinner.fail("view <" + views[i] + "> not found");
            var r = UglifyJS.minify(r.toString("utf-8") + "\n");
            if (!r.code) {
              spinner.fail(" view: " + chalk.red.bold(store[i]));
              return error(r.error);
            }
            streamJS.write(r.code);
            spinner.succeed("processed view: " + chalk.bold(views[i]));
            GVIEW.push(views[i]);
            process_views(views, i + 1, cb);
          }
        );
      }

      nextView();
    }

    function getController(controllers, ndx, cbo) {
      var controller = controllers[ndx];
      if (!controller) return cbo();
      var spinner = ora(
        "processing controller: " + chalk.bold(controller)
      ).start();
      var _controller =
        workspace + "controller/" + controller.replace(/\./g, "/") + ".js";

      fs.readFile(_controller, function (e, r) {
        if (e)
          return spinner.fail(
            chalk.red.bold("controller <" + controller + "> not found")
          );

        var CTRL = r.toString("utf-8");

        var tokens = esprima.tokenize(r.toString("utf-8"));
        var TOKENS = {};
        var bracket = false;
        var token = false;
        for (var el in tokens) {
          if (tokens[el].value == "views") token = "VIEWS";
          if (tokens[el].value == "models") token = "MODELS";
          if (tokens[el].value == "stores") token = "STORES";
          if (tokens[el].value == "[") bracket = true;
          if (tokens[el].value == "]") {
            bracket = false;
            token = false;
          }
          if (bracket) {
            if (token) {
              if (!TOKENS[token]) TOKENS[token] = [];
              if (tokens[el].value != "," && tokens[el].value != "[")
                TOKENS[token].push(
                  tokens[el].value.replace(/"/g, "").replace(/\'/g, "")
                );
            }
          }
        }
        spinner.succeed("processed controller: " + chalk.bold(controller));

        process_models(TOKENS["MODELS"], 0, function () {
          process_stores(TOKENS["STORES"], 0, function () {
            process_views(TOKENS["VIEWS"], 0, function () {
              var r = UglifyJS.minify(CTRL);
              if (!r.code) {
                spinner.fail(" controller: " + chalk.red.bold(controller));
                return error(r.error);
              }
              streamJS.write(r.code);
              getController(controllers, ndx + 1, cbo);
            });
          });
        });
      });
    }

    getController(global.manifest.controllers, 0, cb);
  }

  function process_settings(cb) {
    var CDN = "/modules";
    if (!global.manifest.paths)
      global.manifest.paths = {
        cdn: CDN,
      };
    if (!global.manifest.paths.cdn) global.manifest.paths.cdn = CDN;

    var Settings = {};
    Settings.DEBUG = false;
    Settings.NAMESPACE = global.manifest.namespace;
    Settings.TITLE = global.manifest.title;
    Settings.DESCRIPTION = global.manifest.description;
    Settings.COPYRIGHT = global.manifest.copyright;
    Settings.TYPE = global.manifest.type;
    Settings.PLATFORM = global.manifest.platform;
    Settings.TYPE = global.manifest.platform;
    Settings.LANGS = global.manifest.langs;
    Settings.PATHS = global.manifest.paths;
    Settings.AUTH = {
      passports: [],
      passport: {},
    };
    var paths = {};
    for (var el in global.manifest.paths) {
      paths[el] = global.manifest.paths[el];
    }
    var modules = global.manifest.modules;
    Settings.MODULES = [];
    for (var i = 0; i < modules.length; i++) {
      var item = modules[i];
      if (typeof item == "string") {
        if (item.split(":")[0].indexOf(".") > -1) {
          Settings.PATHS["Ext"] =
            global.manifest.paths.cdn + "/omneedia/modules/Ext";
          Settings.PATHS["Ext.ux"] =
            global.manifest.paths.cdn + "/omneedia/modules/Ext/ux";
          Settings.PATHS["Ext.plugin"] =
            global.manifest.paths.cdn + "/omneedia/modules/Ext/plugin";
          Settings.PATHS["Ext.util"] =
            global.manifest.paths.cdn + "/omneedia/modules/Ext/util";
          if (!Settings.ux) Settings.ux = [];
          Settings.ux.push(item);
        } else {
          if (item.indexOf(":") == -1) var version = "latest";
          else var version = item.split(":")[1];
          if (item.indexOf("://") == -1)
            var url =
              global.manifest.paths.cdn +
              "/dist/" +
              item.split(":")[0] +
              "/" +
              version +
              "/index.js";
          else var url = item;
          Settings.MODULES.push(url);
          Settings.MODULES.push(
            url.substr(0, url.lastIndexOf("/") + 1) + "resources.css"
          );
        }
      } else {
        var params = [];
        for (var el in item) {
          if (el != "src") params.push(el);
        }
        for (var k = 0; k < item.src.length; k++) {
          var url = item.src[k];
          for (var j = 0; j < params.length; j++) {
            var replace = "{" + params[j] + "}";
            var re = new RegExp(replace, "g");
            url = url.replace(re, item[params[j]]);
          }
          if (url.indexOf("://") == -1)
            var url = global.manifest.paths.cdn + "/dist/" + url;
          Settings.MODULES.push(url);
        }
      }
    }

    Settings.CONTROLLERS = [];
    if (global.manifest.controllers)
      for (var i = 0; i < global.manifest.controllers.length; i++)
        Settings.CONTROLLERS.push(global.manifest.controllers[i]);
    Settings.LIBRARIES = [];
    if (global.manifest.libraries)
      for (var i = 0; i < global.manifest.libraries.length; i++)
        Settings.LIBRARIES.push(global.manifest.libraries[i]);
    Settings.AUTHORS = [];
    Settings.API = [];
    Settings.DB = {};
    Settings.API.push("__QUERY__");
    fs.readdir(global.project.api, function (e, r) {
      for (var i = 0; i < r.length; i++) {
        var js = r[i].substr(0, r[i].lastIndexOf(".js"));
        Settings.API.push(js);
      }
      if (global.manifest.api) {
        for (var i = 0; i < global.manifest.api.length; i++) {
          if (global.manifest.api[i].indexOf("@") == -1)
            Settings.API.push(global.manifest.api[i]);
          else {
            if (!Settings.API_REMOTE) Settings.API_REMOTE = {};
            var server = global.manifest.api[i].split("@")[1];
            var url = Settings.PATHS[server];
            Settings.API_REMOTE[server] = "/api/" + server + ".js";
          }
        }
      }
      Settings.AUTHORS.push({
        role: "owner",
        name: global.manifest.author.name,
        mail: global.manifest.author.mail,
        twitter: global.manifest.author.twitter,
        web: global.manifest.author.web,
        github: global.manifest.author.github,
      });
      for (var el in global.manifest.team) {
        var tabx = global.manifest.team[el];
        var role = el;
        if (tabx) {
          for (var i = 0; i < tabx.length; i++) {
            Settings.AUTHORS.push({
              role: role,
              name: tabx[i].name,
              mail: tabx[i].mail,
              twitter: tabx[i].twitter,
              web: tabx[i].web,
              github: tabx[i].github,
            });
          }
        }
      }
      Settings.VERSION = global.manifest.version;
      Settings.BUILD = global.manifest.build;

      if (global.manifest.blur) Settings.blur = global.manifest.blur;
      else Settings.blur = 1;

      // Auth
      function do_auth(cb) {
        function do_i18n(d, ndx, txt, cb) {
          var yaml = require("yaml");
          if (!d[ndx]) return cb();
          fs.readFile(global.project.culture + "/" + d[ndx], "utf-8", function (
            e,
            r
          ) {
            if (e) return do_i18n(d, ndx + 1, txt, cb);
            try {
              var l = yaml.parse(r);
            } catch (e) {
              if (e) return do_i18n(d, ndx + 1, txt, cb);
            }
            if (!l[txt]) l[txt] = txt;
            else return do_i18n(d, ndx + 1, txt, cb);
            fs.writeFile(
              global.project.culture + "/" + d[ndx],
              yaml.stringify(l),
              function (e) {
                return do_i18n(d, ndx + 1, txt, cb);
              }
            );
          });
        }
        function me_auth(auth, i, cb) {
          if (!auth) return cb();
          if (!auth[i]) return cb();
          //if (process.env.dir)
          var root = __dirname + "/../lib/server/lib/tpl";
          //else var root = global.project.home + "/.omneedia";
          var t0 = root + sep + "auth" + sep + auth[i] + ".json";
          fs.readFile(t0, function (e, r) {
            if (e) return error("AUTH template not found");
            try {
              var t0 = JSON.parse(r.toString("utf-8"));
            } catch (e) {
              return error("AUTH template not readable");
            }
            Settings.AUTH.passports.push(t0.type);
            Settings.AUTH.passport[t0.type] = {
              caption: "PASSPORT_" + global.manifest.auth[i].toUpperCase(),
            };
            var dir = fs.readdir(global.project.culture, function (e, dir) {
              do_i18n(
                dir,
                0,
                "PASSPORT_" + global.manifest.auth[i].toUpperCase(),
                function () {
                  me_auth(auth, i + 1, cb);
                }
              );
            });
          });
        }
        me_auth(global.manifest.auth, 0, cb);
      }
      // resources
      function getRES(cb) {
        fs.readdir(global.project.res, function (e, r) {
          var css = [];
          for (var i = 0; i < r.length; i++) {
            if (r[i].indexOf(".css") > -1) css.push("resources/" + r[i]);
          }
          css.push("resources/i18n.css");
          cb(css);
        });
      }

      do_auth(function () {
        getRES(function (css) {
          Settings.MODULES = Settings.MODULES.concat(css);
          streamJS.write("Settings=" + JSON.stringify(Settings) + ";");
          cb();
        });
      });
    });
  }

  function process_js(cb) {
    // parse all modules
    var text = [];
    function process(files, ndx, cb) {
      if (!files[ndx]) return cb();
      var dir = files[ndx];
      var processText = dir.split(
        global.rootdir + "/bin/omneedia_modules/dist/"
      )[1];
      processText = processText
        .substr(0, processText.lastIndexOf("/"))
        .replace("/", ":");
      if (dir.substr(0, 1) == "!") {
        var spinner = ora(
          "processing javascript: " + chalk.bold(path.basename(dir))
        ).start();
        dir = dir.substr(1, dir.length);
        setTimeout(function () {
          fs.readFile(dir, "utf-8", function (e, r) {
            if (e) {
              // on traite l'erreur
              spinner.fail(chalk.red.bold("script <" + dir + "> not found"));
              return;
            }
            r = UglifyJS.minify(r);
            if (!r.code) {
              spinner.fail(
                " processing javascript: " + chalk.red.bold(path.basename(dir))
              );
              return error(r.error);
            }
            text.push(r.code);
            spinner.succeed(
              " processed javascript: " + chalk.bold(path.basename(dir))
            );
            process(files, ndx + 1, cb);
          });
        }, 1000);
      } else {
        var spinner = ora(
          "adding javascript: " + chalk.bold(processText)
        ).start();
        setTimeout(function () {
          fs.readFile(dir, "utf-8", function (e, r) {
            if (e) {
              // on traite l'erreur
              spinner.fail(chalk.red.bold("script <" + dir + "> not found"));
              return;
            }
            text.push(r);
            spinner.succeed(" added javascript: " + chalk.bold(processText));
            process(files, ndx + 1, cb);
          });
        }, 1000);
      }
    }

    var MODULES = [];
    var dist = global.rootdir + "/bin/omneedia_modules/dist/";
    for (var i = 0; i < global.manifest.modules.length; i++) {
      var module = global.manifest.modules[i];
      if (typeof module == "string") {
        MODULES.push(dist + module.replace(":", "/") + "/index.js");
      } else {
        // object
        var params = [];
        for (var el in module) {
          if (el != "src") {
            if (typeof module[el] == "string") params.push(el);
          }
        }

        for (var k = 0; k < module.src.length; k++) {
          var mod = module.src[k];
          for (var j = 0; j < params.length; j++) {
            var replace = "{" + params[j] + "}";
            var re = new RegExp(replace, "g");
            mod = mod.replace(re, module[params[j]]);
          }
          if (mod.indexOf(".css") == -1) MODULES.push("!" + dist + mod);
        }
      }
    }
    process(MODULES, 0, function () {
      streamJS.write(text.join(""));
      cb();
    });
  }

  function process_index(cb) {
    var fs = require("fs");
    var path = require("path");
    var UglifyCSS = require("uglifycss");
    var IM = require("jimp");
    var minify = require("html-minifier").minify;

    var assets = {};

    var style, html;

    var spinner = ora("building");

    function mktpl(texto) {
      var dot = require("dot-prop");

      var item = texto.split("{{");
      for (var i = 0; i < item.length; i++) {
        if (item[i].indexOf("}}") > -1) {
          var obj = item[i].substr(0, item[i].indexOf("}}"));
          var o = eval("global." + obj.split(".")[0]);
          var dots = obj.substr(obj.indexOf(".") + 1, obj.length);
          item[i] =
            dot.get(o, dots) +
            item[i].substr(item[i].lastIndexOf("}}") + 2, item[i].length);
        }
      }

      return item.join("");
    }

    function img(x, i, cb) {
      if (!x[i]) return cb();
      IM.read(global.rootdir + "/" + x[i].src, function (err, IMG) {
        if (err) throw err;
        if (x[i].transform.resize) {
          var values = x[i].transform["resize"].split(",");
          IMG.resize(values[0] * 1, values[1] * 1).getBase64(
            IM.MIME_PNG,
            function (err, src) {
              if (err) throw err;
              assets["/resources/" + x[i].dest] = src;
              img(x, i + 1, cb);
            }
          );
        }
      });
    }
    fs.readFile(global.rootdir + "/.template/assets.json", function (e, tpl) {
      if (e) return error("template not found");

      var tpl = mktpl(tpl.toString("utf-8"));
      tpl = JSON.parse(tpl);

      // prepare image
      img(tpl, 0, function () {
        fs.readFile(global.rootdir + "/.template/assets.css", function (
          e,
          tpl
        ) {
          if (e) throw e;
          style = tpl.toString("utf-8");
          style = mktpl(style);
          for (var el in assets) {
            var re = new RegExp(el, "g");
            style = style.replace(re, assets[el]);
          }
          fs.readFile(global.rootdir + "/.template/assets.html", function (
            e,
            tpl
          ) {
            if (e) throw e;
            html = tpl.toString("utf-8");
            html = mktpl(html);
            html = html.replace("<head>", "<head><style>" + style + "</style>");
            html = html.replace("<head>", '<head><base href="">');
            html = html.replace(
              "<head>",
              '<head><meta name="mobile-web-app-capable" content="yes">'
            );
            html = html.replace(
              "<head>",
              '<head><meta name="apple-mobile-web-app-title" content="' +
                global.manifest.title +
                '">'
            );
            html = html.replace(
              "<head>",
              '<head><meta name="apple-mobile-web-app-status-bar-style" content="black">'
            );
            IM.read(global.rootdir + "/" + global.manifest.icon.file, function (
              err,
              im
            ) {
              if (err) throw err;
              im.resize(16, 16).getBase64(IM.MIME_PNG, function (err, src) {
                if (err) throw err;
                html = html.replace(
                  "</head>",
                  '<link rel="icon" type="image/png" href="data:image/png;base64,' +
                    src.split(",")[1] +
                    '"/></head>'
                );
                fs.readFile(
                  __dirname +
                    "/../lib/server/lib/tpl/bootstrap-" +
                    global.manifest.platform +
                    "-prod.tpl",
                  function (e, tpl) {
                    if (e) throw e;
                    html = html.replace(
                      "</body>",
                      tpl.toString("utf-8") + "</body>"
                    );
                    var min = minify(
                      html.replace(/\t/g, "").replace(/\n/g, ""),
                      {
                        removeAttributeQuotes: true,
                      }
                    );
                    spinner.succeed("built.");
                    fs.writeFile(
                      global.rootdir + "/dist/www/index.html",
                      min,
                      cb
                    );
                  }
                );
              });
            });
          });
        });
      });
    });
  }

  function copyFiles(path, d, ndx, cb, prefix) {
    if (!d[ndx]) return cb();
    if (d[ndx].split(path)[1].indexOf(".DS_Store") > -1)
      return copyFiles(path, d, ndx + 1, cb, prefix);
    if (!prefix) prefix = "";
    var destfile =
      global.rootdir + "/dist/" + prefix + "/" + d[ndx].split(path)[1];
    var dest = require("path").dirname(destfile) + "/" + prefix;
    if (destfile.substr(destfile.lastIndexOf("."), destfile.length) == ".js")
      var spin = ora("processing: " + chalk.bold(d[ndx].split(path)[1]));
    else var spin = ora("copying: " + chalk.bold(d[ndx].split(path)[1]));
    fs.mkdir(dest, { recursive: true }, function () {
      if (
        destfile.substr(destfile.lastIndexOf("."), destfile.length) == ".js"
      ) {
        fs.readFile(d[ndx], "utf-8", function (ee, rr) {
          if (ee) return error("not found");
          var response = UglifyJS.minify(rr);
          if (!response.code) {
            spin.fail("process error: " + chalk.bold(d[ndx].split(path)[1]));
            error(response.error);
          }
          if (response.code)
            fs.writeFile(destfile, response.code, function () {
              spin.succeed("processed: " + chalk.bold(d[ndx].split(path)[1]));
              copyFiles(path, d, ndx + 1, cb, prefix);
            });
        });
      } else {
        fs.copyFile(d[ndx], destfile, function (e) {
          spin.succeed("copied: " + chalk.bold(d[ndx].split(path)[1]));
          copyFiles(path, d, ndx + 1, cb, prefix);
        });
      }
    });
  }

  function copy_lib(cb) {
    var fs = require("fs");
    var path = require("path");

    var path = require("path").normalize(__dirname + "/../lib/server/");
    walk(path, function (e, d) {
      copyFiles(path, d, 0, cb);
    });
  }

  function process_yaml(cb) {
    var manifest = global.manifest;
    delete manifest.modules;
    delete manifest.packages;
    delete manifest.controllers;
    delete manifest.db;
    delete manifest.tests;
    delete manifest.icon;
    delete manifest.splashscreen;
    fs.writeFile(
      global.rootdir + "/dist/manifest.yaml",
      yaml.stringify(manifest),
      cb
    );
  }

  function process_dockerfile() {
    var str = [
      "FROM node:12.15.0-slim",
      'LABEL maintainer="' + global.manifest.author.name + '"',
      'LABEL version="' + global.manifest.version + '"',
      'LABEL description="' + global.manifest.description + '"',
      " ",
      "RUN mkdir -p /usr/src",
      "WORKDIR /usr/src",
      "COPY . /usr/src",
      " ",
      "RUN npm install .",
      " ",
      "EXPOSE 8000",
      " ",
      'CMD ["node","server"]',
    ];
    fs.writeFile(
      global.rootdir + "/dist/Dockerfile",
      str.join("\n"),
      function () {
        process_yaml(function () {
          console.log(
            "\n" + logSymbols.success + " application has been built\n"
          );
        });
      }
    );
  }

  function copy_app() {
    var path = require("path").normalize(global.rootdir + "/src/services/");
    walk(path, function (e, d) {
      copyFiles(
        path,
        d,
        0,
        function () {
          console.log(chalk.yellow.bold("\n- using auth"));
          var path = require("path").normalize(global.rootdir + "/src/auth/");
          walk(path, function (e, d) {
            copyFiles(
              path,
              d,
              0,
              function () {
                var path = require("path").normalize(
                  global.rootdir + "/src/io/"
                );
                console.log(chalk.yellow.bold("\n- using io"));
                walk(path, function (e, d) {
                  copyFiles(
                    path,
                    d,
                    0,
                    function () {
                      var path = require("path").normalize(
                        global.rootdir + "/src/jobs/"
                      );
                      walk(path, function (e, d) {
                        copyFiles(
                          path,
                          d,
                          0,
                          function () {
                            console.log(
                              chalk.yellow.bold("\n- using processes")
                            );
                            var path = require("path").normalize(
                              global.rootdir + "/src/processes/"
                            );
                            walk(path, function (e, d) {
                              copyFiles(
                                path,
                                d,
                                0,
                                function () {
                                  console.log(
                                    chalk.yellow.bold("\n- using system")
                                  );
                                  var path = require("path").normalize(
                                    global.rootdir + "/src/system/"
                                  );
                                  walk(path, function (e, d) {
                                    copyFiles(
                                      path,
                                      d,
                                      0,
                                      function () {
                                        console.log(
                                          chalk.yellow.bold(
                                            "\n- processing Dockerfile & manifest"
                                          )
                                        );
                                        process_dockerfile();
                                      },
                                      "system"
                                    );
                                  });
                                },
                                "processes"
                              );
                            });
                          },
                          "jobs"
                        );
                      });
                    },
                    "io"
                  );
                });
              },
              "auth"
            );
          });
        },
        "services"
      );
    });
  }

  function serverside_build() {
    console.log(chalk.yellow.bold("\n- generating package"));
    var package = require("path").normalize(__dirname + "/../package.json");
    fs.readFile(package, "utf-8", function (e, r) {
      if (e) return error("package not found");
      var pkg = JSON.parse(r);
      var dependencies = pkg.dependencies;
      var pkg = {
        name: global.manifest.namespace,
        description: global.manifest.description,
        version: global.manifest.version,
        license: global.manifest.license,
        deprecated: false,
        main: "index.js",
        dependencies: dependencies,
      };
      if (!global.manifest.packages) global.manifest.packages = [];
      for (var i = 0; i < global.manifest.packages.length; i++) {
        pkg.dependencies[
          global.manifest.packages[i].split(":")[0]
        ] = global.manifest.packages[i].split(":")[1];
      }
      fs.writeFile(
        global.rootdir + "/dist/package.json",
        JSON.stringify(pkg, null, 4),
        function (e) {
          console.log(chalk.yellow.bold("\n- installing serverside"));
          copy_lib(function () {
            copy_app(function () {});
          });
          //console.log(chalk.yellow.bold("\n- copy serverside"));
        }
      );
    });
  }

  findUp("manifest.yaml").then(function (test) {
    if (!test) return error("You must be inside an omneedia app directory");
    global.rootdir = path.dirname(test);

    fs.readFile(test, "utf-8", function (e, r) {
      try {
        global.manifest = yaml.parse(r);
      } catch (e) {
        error("There is an error with your package");
      }
      console.log(
        boxen(
          chalk.cyan(
            " " +
              chalk.bold(global.manifest.namespace) +
              "@" +
              chalk.bold(global.manifest.version) +
              " "
          ),
          { float: "center", borderStyle: "round", borderColor: "cyan" }
        )
      );
      if (!global.rootdir) return error("Directory error");
      updateApp(function () {
        rmdir(global.rootdir + "/dist", function () {
          fs.mkdir(
            global.rootdir + "/dist/www",
            {
              recursive: true,
            },
            function (e) {
              var cmd = [];
              streamJS = fs.createWriteStream(
                global.rootdir + "/dist/www/app.js",
                {
                  flags: "a",
                  encoding: null,
                  mode: 0666,
                }
              );
              //return serverside_build();
              console.log(chalk.yellow.bold("\n- generating settings"));
              process_settings(function () {
                console.log(chalk.yellow.bold("\n- processing modules"));
                process_js(function () {
                  console.log(chalk.yellow.bold("\n- processing MVC"));
                  process_mvc(function () {
                    console.log(chalk.yellow.bold("\n- registering services"));
                    process_services(function (services) {
                      console.log(chalk.yellow.bold("\n- bundle app.js"));
                      streamJS.write(';window.z="0mneediaRulez!";App.load();');
                      streamJS.end(function () {
                        console.log(
                          chalk.yellow.bold("\n- generating index.html")
                        );
                        process_index(function (ndx) {
                          console.log(
                            chalk.yellow.bold("\n- generating resources")
                          );
                          process_resources(function () {
                            console.log(
                              chalk.yellow.bold("\n- processing i18n")
                            );
                            process_i18n(function () {
                              CSSStream.end(function () {
                                serverside_build();
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            }
          );
        });
      });
    });
  });
};
