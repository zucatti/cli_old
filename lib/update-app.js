module.exports = function (cbz) {
  var inquirer = require("inquirer");
  var error = require("./utils/error");
  var fs = require("fs");
  var chalk = require("chalk");
  var logSymbols = require("log-symbols");
  var shelljs = require("shelljs");
  var yaml = require("yaml");
  const { Observable } = require("rxjs");
  const Listr = require("listr");

  Array.prototype.remove = function () {
    var what,
      a = arguments,
      L = a.length,
      ax;
    while (L && this.length) {
      what = a[--L];
      while ((ax = this.indexOf(what)) !== -1) {
        this.splice(ax, 1);
      }
    }
    return this;
  };

  function update_settings(cb) {
    fs.mkdir(global.dir + "/config/", { recursive: true }, function () {
      fs.writeFile(
        global.dir + "/config/settings.json",
        JSON.stringify(global.settings, null, 4),
        cb
      );
    });
  }
  function update_package_json(ff, cb) {
    fs.writeFile(
      global.project.bin + "/package.json",
      JSON.stringify(ff, null, 4),
      cb
    );
  }
  function update_module_json(ff, cb) {
    fs.writeFile(
      global.project.bin + "/module.json",
      JSON.stringify(ff, null, 4),
      cb
    );
  }

  function updateModules(cb) {
    var pkg = global.manifest.modules;
    var FIRST_TIME = true;
    var DO_SOMETHING = false;
    var module_json;
    function do_module(p, ndx, installed, cbo) {
      if (!p[ndx]) return cbo();
      var item = p[ndx];
      var _installed = [];
      for (var z = 0; z < installed.length; z++) {
        if (installed[z].split(":").length > 1) {
          _installed.push(
            installed[z].split(":")[0] +
              ":" +
              installed[z].split(":")[1].substr(1, installed[z].length)
          );
        }
      }
      if (installed.indexOf(item) > -1)
        return do_module(p, ndx + 1, installed, cbo);
      if (_installed.indexOf(item) > -1)
        return do_module(p, ndx + 1, installed, cbo);
      shelljs.cd(global.project.bin);
      if (FIRST_TIME) {
        console.log(chalk.bold("- Updating modules "));
        DO_SOMETHING = true;
      }
      FIRST_TIME = false;
      const tasks = new Listr([
        {
          title: "installing " + item,
          task: () => {
            return new Observable((observer) => {
              observer.next("Please wait...");
              var exec = require("child_process").spawn,
                child;
              child = exec("oa2", ["module", "install", item]);
              child.on("close", function () {
                module_json.dependencies[item.split(":")[0]] = item.split(
                  ":"
                )[1];
                observer.complete();
                update_module_json(module_json, function () {
                  do_module(p, ndx + 1, installed, cbo);
                });
              });
            });
          },
        },
      ]);
      tasks.run().catch((err) => {});
    }
    fs.mkdir(global.project.bin, function (e) {
      fs.readFile(global.project.bin + "/module.json", "utf-8", function (
        e,
        r
      ) {
        if (e)
          module_json = {
            name: global.manifest.namespace,
            description: global.manifest.description,
            dependencies: {},
            license: global.manifest.license,
          };
        else module_json = JSON.parse(r);
        update_module_json(module_json, function () {
          if (!pkg) {
            package_module.dependencies = {};
            return update_module_json(module_json, function () {
              shelljs.cd(global.project.bin);
              shelljs.exec("oa2 module install", { silent: true }, function () {
                return cb();
              });
            });
          }
          if (pkg.length == 0) {
            module_json.dependencies = {};
            return update_module_json(module_json, function () {
              shelljs.cd(global.project.bin);
              shelljs.exec("oa2 module install", { silent: true }, function () {
                return cb();
              });
            });
          }
          var pkg_installed = [];
          for (var el in module_json.dependencies)
            pkg_installed.push(el + ":" + module_json.dependencies[el]);
          var _installed = [];
          for (var z = 0; z < pkg_installed.length; z++) {
            if (pkg_installed[z].split(":").length > 1) {
              _installed.push(
                pkg_installed[z].split(":")[0] +
                  ":" +
                  pkg_installed[z]
                    .split(":")[1]
                    .substr(1, pkg_installed[z].length)
              );
            }
          }
          do_module(pkg, 0, pkg_installed, cb);
        });
      });
    });
  }

  function updatePackages(cb) {
    var pkg = global.manifest.packages;
    var FIRST_TIME = true;
    var DO_SOMETHING = false;
    function do_pkg(p, ndx, installed, cbo) {
      if (!p[ndx]) return cbo();
      var item = p[ndx];
      var _installed = [];
      for (var z = 0; z < installed.length; z++) {
        if (installed[z].split(":").length > 1) {
          _installed.push(
            installed[z].split(":")[0] +
              ":" +
              installed[z].split(":")[1].substr(1, installed[z].length)
          );
        }
      }
      if (installed.indexOf(item) > -1)
        return do_pkg(p, ndx + 1, installed, cbo);
      if (_installed.indexOf(item) > -1)
        return do_pkg(p, ndx + 1, installed, cbo);
      shelljs.cd(global.project.bin);
      if (FIRST_TIME) {
        console.log(chalk.bold("- Updating packages "));
        DO_SOMETHING = true;
      }
      FIRST_TIME = false;
      const tasks = new Listr([
        {
          title: "installing " + item,
          task: () => {
            return new Observable((observer) => {
              observer.next("Please wait...");
              var exec = require("child_process").spawn,
                child;
              child = exec("npm", ["install", item.replace(":", "@")]);

              child.on("close", function () {
                observer.complete();
                fs.readFile(
                  global.project.bin +
                    "/node_modules/" +
                    item.split(":")[0] +
                    "/package.json",
                  "utf-8",
                  function (e, r) {
                    var json = JSON.parse(r);
                    p[ndx] = item.split(":")[0] + ":" + json.version;
                    observer.complete();
                    do_pkg(p, ndx + 1, installed, cbo);
                  }
                );
              });
            });
          },
        },
      ]);
      tasks.run().catch((err) => {});
    }
    fs.mkdir(global.project.bin, function (e) {
      fs.readFile(global.project.bin + "/package.json", "utf-8", function (
        e,
        r
      ) {
        if (e)
          var package_json = {
            name: global.manifest.namespace,
            description: global.manifest.description,
            dependencies: {},
            license: global.manifest.license,
          };
        else var package_json = JSON.parse(r);
        update_package_json(package_json, function () {
          if (!pkg) {
            package_json.dependencies = {};
            return update_package_json(package_json, function () {
              shelljs.cd(global.project.bin);
              shelljs.exec("npm install", { silent: true }, function () {
                return cb();
              });
            });
          }
          if (pkg.length == 0) {
            package_json.dependencies = {};
            return update_package_json(package_json, function () {
              shelljs.cd(global.project.bin);
              shelljs.exec("npm install", { silent: true }, function () {
                return cb();
              });
            });
          }
          var pkg_installed = [];
          for (var el in package_json.dependencies)
            pkg_installed.push(el + ":" + package_json.dependencies[el]);
          var _installed = [];
          for (var z = 0; z < pkg_installed.length; z++) {
            if (pkg_installed[z].split(":").length > 1) {
              _installed.push(
                pkg_installed[z].split(":")[0] +
                  ":" +
                  pkg_installed[z]
                    .split(":")[1]
                    .substr(1, pkg_installed[z].length)
              );
            }
          }
          do_pkg(pkg, 0, pkg_installed, function () {
            fs.writeFile(
              global.dir + "/manifest.yaml",
              yaml.stringify(global.manifest),
              function () {
                var i = pkg_installed.length;
                var uninstall = [];
                while (i--) {
                  if (pkg.indexOf(_installed[i]) == -1) {
                    // on supprime le fichier du package.json
                    uninstall.push(_installed[i].split(":")[0]);
                    delete package_json.dependencies[
                      _installed[i].split(":")[0]
                    ];
                  }
                }
                if (uninstall.length > 0)
                  console.log(chalk.bold("- Cleaning packages "));
                if (uninstall.length > 0)
                  return update_package_json(package_json, function () {
                    shelljs.cd(global.project.bin);
                    shelljs.exec("npm install", { silent: true }, function () {
                      //if (DO_SOMETHING) console.log(' ');
                      return cb();
                    });
                  });
                //if (DO_SOMETHING) console.log(' ');
                cb();
              }
            );
          });
        });
      });
    });
  }

  function updateAuth(cb) {
    function do_auth(a, ndx, cbo) {
      if (!a[ndx]) return cbo();
      for (var i = 0; i < global.settings.auth.length; i++) {
        if (global.settings.auth[i].name == a[ndx])
          return do_auth(a, ndx + 1, cbo);
      }
      var tpl = __dirname + "/server/lib/tpl/auth/" + a[ndx] + ".json";
      fs.readFile(tpl, "utf-8", function (e, r) {
        if (e) return error("AUTH template not found");
        var yauth = JSON.parse(r);
        var params = yauth.params;
        var list = [];
        if (params.length == 0) {
          console.log(chalk.bold("- Updating auth: ") + chalk.cyan(a[ndx]));
          var o = yauth.config;
          o.name = a[ndx];
          o.type = yauth.type;
          global.settings.auth.push(o);
          update_settings(function () {
            do_auth(a, ndx + 1, cbo);
          });
        } else {
          for (var j = 0; j < params.length; j++) {
            var o = {
              type: "input",
              name: params[j],
              default: yauth.config.login[params[j]],
              message: "  " + params[j],
            };
            list.push(o);
          }
          console.log(chalk.bold("- Updating auth: ") + chalk.cyan(a[ndx]));
          inquirer.prompt(list).then((answers) => {
            var o = yauth.config;
            o.name = a[ndx];
            o.type = yauth.type;
            for (var el in answers) {
              o.login[el] = answers[el];
            }
            global.settings.auth.push(o);
            update_settings(function () {
              do_auth(a, ndx + 1, cbo);
            });
          });
        }
      });
    }
    var auth = global.manifest.auth;
    if (!auth) {
      global.settings.auth = [];
      return update_settings(cb);
    }
    if (auth.length == 0) {
      global.settings.auth = [];
      return update_settings(cb);
    }
    do_auth(auth, 0, function () {
      var i = global.settings.auth.length;
      while (i--) {
        if (auth.indexOf(global.settings.auth[i].name) == -1) {
          global.settings.auth.splice(i, 1);
        }
      }
      update_settings(cb);
    });
    var settings_auth = global.settings.auth;
    if (!settings_auth) return cb();
  }
  function updateDB(cb) {
    var db = global.manifest.db;
    function do_db(a, ndx, cbo) {
      if (!a[ndx]) return cbo();
      for (var i = 0; i < global.settings.db.length; i++) {
        if (global.settings.db[i].name == a[ndx]) return do_db(a, ndx + 1, cbo);
      }
      global.settings.db.push({
        name: a[ndx],
        uri: "mysql://root@localhost/" + a[ndx],
      });
      update_settings(function () {
        do_db(a, ndx + 1, cbo);
      });
    }
    if (!db) {
      global.settings.db = [];
      return update_settings(cb);
    }
    if (db.length == 0) {
      global.settings.db = [];
      return update_settings(cb);
    }
    do_db(db, 0, function () {
      var i = global.settings.db.length;
      while (i--) {
        if (db.indexOf(global.settings.db[i].name) == -1) {
          global.settings.db.splice(i, 1);
        }
      }
      update_settings(cb);
    });
  }
  //console.log('-  Update settings');
  fs.readFile(global.dir + "/config/settings.json", "utf-8", function (e, r) {
    if (r) global.settings = JSON.parse(r);
    else
      global.settings = {
        auth: [],
        db: [],
      };
    updateAuth(function () {
      updateDB(function () {
        updatePackages(function () {
          updateModules(cbz);
        });
      });
    });
  });
};
