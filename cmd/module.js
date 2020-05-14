module.exports = function (args, root) {
  var url_modules =
    "https://gitlab.com/api/v4/groups/oa-registry/projects?perpage=100";
  var oa_registry_url = "https://gitlab.com/oa-registry/";
  var findUp = require("find-up");
  var prettyjson = require("prettyjson");
  var shelljs = require("shelljs");
  var logSymbols = require("log-symbols");
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

  var JS = [];
  var CSS = [];
  var resources = [];
  var ITEMS = [];

  function loadBase64Image(ITEMS, len, cb, i) {
    if (!i) i = 0;
    if (i == len) {
      console.log(logSymbols.success + "  processed.");
      return cb(ITEMS);
    }
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
      "   [" +
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
          var str = "	! NOT FOUND: " + item;
          ITEMS[el] = "";
        }
        process.stdout.clearLine(); // clear current text
        process.stdout.cursorTo(0);
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
          process.stdout.clearLine(); // clear current text
          process.stdout.cursorTo(0);

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

  function compileCSS(body, cb, url) {
    console.log(
      "   processing: " + url.substr(url.lastIndexOf("/") + 1, url.length)
    );

    // remote content
    var durl = url.lastIndexOf("/");
    durl = url.substr(0, durl);
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
      CSS.push(css);

      cb();
    });
  }

  function tpl(url) {
    var params = [];
    for (var el in global.config) {
      if (el != "src") params.push(el);
    }
    for (var j = 0; j < params.length; j++) {
      var replace = "{" + params[j] + "}";
      var re = new RegExp(replace, "g");
      url = url.replace(re, global.config[params[j]]);
    }
    return url;
  }

  function transpiler(src, ndx, cb) {
    if (!src[ndx]) return cb();
    var dir = tpl(global.config.src[ndx]);

    if (dir.indexOf(".js") > -1) {
      var spinner = ora(
        "adding javascript: " + chalk.bold(path.basename(dir))
      ).start();

      setTimeout(function () {
        fs.readFile(global.root + "/src/" + dir, "utf-8", function (e, b) {
          var result = UglifyJS.minify(b);
          if (e) return error("Source not found");
          JS.push(result.code);
          if (!result.code) {
            spinner.fail(
              " adding javascript: " + chalk.red.bold(path.basename(dir))
            );
            return error(result.error);
          }
          spinner.succeed(
            " added javascript: " + chalk.bold(path.basename(dir))
          );
          transpiler(src, ndx + 1, cb);
        });
      }, 1000);
      return;
    }

    if (dir.indexOf(".css") > -1) {
      var spinner = ora(
        "adding resource:   " + chalk.bold(path.basename(dir))
      ).start();
      fs.readFile(global.root + "/src/" + dir, "utf-8", function (e, b) {
        spinner.succeed(" added resource:   " + chalk.bold(path.basename(dir)));
        compileCSS(
          b,
          function () {
            transpiler(src, ndx + 1, cb);
          },
          global.root + "/src/" + dir
        );
      });
    }
  }

  function build_i18n(cb) {
    if (!global.config.i18n) return cb();
    var i18n_dir = global.root + "/src/" + tpl(global.config.i18n);
    function update_langs(langs, ndx, cb) {
      if (!langs[ndx]) return cb();
      var lang = langs[ndx].split(".yaml")[0];
      fs.readFile(i18n_dir + "/" + lang + ".yaml", function (e, r) {
        if (e) return update_langs(langs, ndx + 1, cb);
        var l = yaml.parse(r.toString("utf-8"));
        for (var el in l) {
          CSS.push(
            ":lang(" +
              lang +
              ")." +
              el +
              ":before { content: '" +
              l[el].replace(/'/g, "\\'") +
              "' }"
          );
        }
        update_langs(langs, ndx + 1, cb);
      });
    }
    fs.readdir(i18n_dir, function (e, langs) {
      update_langs(langs, 0, cb);
    });
  }

  if (args[0] == "install") {
    var matrix = {};

    var calculate_dependencies = function (dependencies) {
      var keys = Object.keys(dependencies),
        used = new Set(),
        result = [],
        items,
        length;

      do {
        length = keys.length;
        items = [];
        keys = keys.filter((k) => {
          if (!dependencies[k].every(Set.prototype.has, used)) return true;
          items.push(k);
        });
        result.push(...items);
        items.forEach(Set.prototype.add, used);
      } while (keys.length && keys.length !== length);

      result.push(...keys);
      return result;
    };

    if (!global.dir)
      return error("You're not inside an omneedia app directory");
    global.project = {
      home: global.dir,
    };

    var requires = [];

    global.project.bin = global.dir + "/bin";
    global.project.api = global.project.home + "/services";
    global.project.res = global.project.home + "/resources";
    global.project.culture = global.project.home + "/culture";
    global.project.auth = global.project.home + "/auth";
    global.project.system = global.project.home + "/system";
    global.project.io = global.project.home + "/io";

    fs.readFile(global.dir + "/manifest.yaml", "utf-8", function (e, r) {
      global.manifest = yaml.parse(r);
      console.log(
        boxen(chalk.cyan(" " + manifest.namespace + " "), {
          float: "center",
          borderStyle: "round",
          borderColor: "cyan",
        })
      );

      if (!args[1]) return error("You must provide a module name");

      var spinner = ora("looking up registry").start();

      global.request(url_modules, function (e, r, b) {
        var list = JSON.parse(b);
        var mods = [];
        var mod = {};
        for (var i = 0; i < list.length; i++) {
          var name = list[i].name;
          var version = name.split("_")[1];
          name = name.split("_")[0];
          if (mods.indexOf(name) == -1) mods.push(name);
          if (!mod[name])
            mod[name] = {
              url: list[i].web_url,
              version: [],
            };
          if (mod[name].version.indexOf(version) == -1)
            mod[name].version.push(version);
        }

        function installIt(moz, ndx, cb) {
          if (!moz[ndx]) {
            if (!global.manifest.modules) global.manifest.modules = [];
            var mozx = calculate_dependencies(matrix);
            for (var z = 0; z < mozx.length; z++) {
              if (global.manifest.modules.indexOf(mozx[z]) == -1)
                global.manifest.modules.push(mozx[z]);
            }
            return fs.writeFile(
              global.dir + "/manifest.yaml",
              yaml.stringify(global.manifest),
              cb
            );
          }
          if (moz[ndx].indexOf("@") > -1) {
            var pname = moz[ndx].split("@")[0];
            var pversion = moz[ndx].split("@");
          } else {
            var pname = moz[ndx].split(":")[0];
            var pversion = moz[ndx].split(":");
          }

          if (pversion[1]) pversion = pversion[1];
          else pversion = -1;

          var modules = global.manifest.modules;
          if (!modules) modules = [];
          var _modules = [];
          var _module = {};
          for (var i = 0; i < modules.length; i++) {
            if (modules[i].module) {
              var name = modules[i].module;
              var version = modules[i].version;
            } else {
              var name = modules[i];
              if (name.indexOf(":") > -1) var version = name.split(":")[1];
              else var version = -1;
              name = modules[i].split(":")[0];
            }
            if (_modules.indexOf(name) == -1) _modules.push(name);
            if (!_module[name]) _module[name] = [];
            _module[name].push(version);
          }

          if (mods.indexOf(pname) == -1) return error("Module not found");
          if (pversion == "-1")
            pversion = mod[pname].version[mod[pname].version.length - 1];
          else {
            if (mod[pname].version.indexOf(pversion) == -1)
              return error("Version not found");
          }

          var url =
            oa_registry_url + pname + "_" + pversion + "/-/archive/master/";
          url += pname + "_" + pversion + "-master.zip";

          console.log(
            chalk.bold("\ninstalling module " + pname + "@" + pversion + "\t")
          );

          spinner = ora("loading module").start();
          global
            .request(url)
            .pipe(unzip.Extract({ path: global.project.bin + "/tmp" }))
            .on("close", function () {
              spinner.succeed(
                "module loaded" +
                  chalk.green.bold("\t\t" + logSymbols.success + " ok")
              );
              // read package
              spinner = ora("installing module").start();
              fs.readFile(
                global.project.bin +
                  "/tmp/" +
                  pname +
                  "_" +
                  pversion +
                  "-master/package.yaml",
                "utf-8",
                function (e, r) {
                  if (e) return error("Module manifest not found");
                  try {
                    var pkg = yaml.parse(r);
                  } catch (e) {
                    return error("Module configuration error");
                  }
                  moz[ndx] = pname + ":" + pversion;
                  if (pkg.require) {
                    for (var j = 0; j < pkg.require.length; j++) {
                      if (moz.indexOf(pkg.require[j]) == -1) {
                        moz.push(pkg.require[j]);
                      }
                    }
                    matrix[pname + ":" + pversion] = pkg.require;
                  } else matrix[pname + ":" + pversion] = [];
                  fs.mkdir(
                    global.project.bin +
                      "/omneedia_modules/dist/" +
                      pname +
                      "/" +
                      pversion,
                    { recursive: true },
                    function (e) {
                      fs.copyFile(
                        global.project.bin +
                          "/tmp/" +
                          pname +
                          "_" +
                          pversion +
                          "-master/dist/index.js",
                        global.project.bin +
                          "/omneedia_modules/dist/" +
                          pname +
                          "/" +
                          pversion +
                          "/index.js",
                        function (e) {
                          fs.copyFile(
                            global.project.bin +
                              "/tmp/" +
                              pname +
                              "_" +
                              pversion +
                              "-master/dist/resources.css",
                            global.project.bin +
                              "/omneedia_modules/dist/" +
                              pname +
                              "/" +
                              pversion +
                              "/resources.css",
                            function (e) {
                              fs.copyFile(
                                global.project.bin +
                                  "/tmp/" +
                                  pname +
                                  "_" +
                                  pversion +
                                  "-master/package.yaml",
                                global.project.bin +
                                  "/omneedia_modules/dist/" +
                                  pname +
                                  "@" +
                                  pversion +
                                  ".yaml",
                                function (e) {
                                  rimraf(
                                    global.project.bin + "/tmp",
                                    function () {
                                      spinner.succeed(
                                        "module installed" +
                                          chalk.green.bold(
                                            "\t" + logSymbols.success + " ok"
                                          )
                                      );
                                      installIt(moz, ndx + 1, cb);
                                    }
                                  );
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            });
        }
        spinner.succeed(
          "looking up registry\t" + logSymbols.success + chalk.green.bold(" ok")
        );
        args.shift();
        requires = requires.concat(args);

        installIt(requires, 0, function () {
          console.log("\n" + logSymbols.success + chalk.green(" all done.\n"));
        });
      });
    });

    return;
  }

  if (args[0] == "uninstall") {
    if (!global.dir)
      return error("You're not inside an omneedia app directory");
    global.project = {
      home: global.dir,
    };

    var requires = [];

    global.project.bin = global.dir + "/bin";
    global.project.api = global.project.home + "/services";
    global.project.res = global.project.home + "/resources";
    global.project.culture = global.project.home + "/culture";
    global.project.auth = global.project.home + "/auth";
    global.project.system = global.project.home + "/system";
    global.project.io = global.project.home + "/io";

    return fs.readFile(global.dir + "/manifest.yaml", "utf-8", function (e, r) {
      global.manifest = yaml.parse(r);
      console.log(
        boxen(chalk.cyan(" " + manifest.namespace + " "), {
          float: "center",
          borderStyle: "round",
          borderColor: "cyan",
        })
      );
      if (!global.manifest.modules) return error("no module installed.");
      if (!args[1]) return error("You must provide a module name");
      // read all the manifests for cross requires
      fs.readdir(global.project.bin + "/omneedia_modules/dist/", function (
        e,
        r
      ) {
        if (e) return error("no module installed.");
        console.log(r);
      });
      /*
            var mods = [];
            for (var i = 0; i < global.manifest.modules.length; i++) {
                if (global.manifest.modules[i].split('@')[0].split(':')[0]) {
                    return rimraf(global.project.bin + '/omneedia_modules/dist/' + args[1], function () {
                        var pkg = global.project.bin + '/omneedia_modules/dist/' + global.manifest.modules[i].split(':')[0] + '@' + global.manifest.modules[i].split(':')[1] + '.yaml';
                        delete global.manifest.modules[i];
                        fs.unlink(pkg, function (e) {
                            fs.writeFile(global.dir + '/manifest.yaml', yaml.stringify(global.manifest), function () {
                                console.log('\n' + logSymbols.success + chalk.green(' module uninstalled.\n'));
                            });
                        });
                    });
                }
            };
            */
      //return error('Module is not installed.');
    });
  }

  if (args[0] == "build") {
    findUp("package.yaml").then(function (test) {
      if (!test)
        return error("You must be inside an omneedia module directory");
      global.root = path.dirname(test);

      fs.readFile(test, "utf-8", function (e, r) {
        try {
          global.config = yaml.parse(r);
        } catch (e) {
          error("There is an error with your package");
        }
        console.log(
          boxen(
            chalk.cyan(
              " " +
                "Module : " +
                chalk.bold(global.config.module) +
                "@" +
                chalk.bold(global.config.version) +
                " "
            ),
            { float: "center", borderStyle: "round", borderColor: "cyan" }
          )
        );
        if (!global.root) return error("Directory error");
        console.log(chalk.yellow.bold("\nBuilding module"));
        rmdir(global.root + "/dist", function () {
          fs.mkdir(
            global.root + "/dist",
            {
              recursive: true,
            },
            function (e) {
              var cmd = [];
              build_i18n(function () {
                transpiler(global.config.src, 0, function () {
                  fs.writeFile(
                    global.root + "/dist/index.js",
                    JS.join(";"),
                    function () {
                      fs.writeFile(
                        global.root + "/dist/resources.css",
                        CSS.join(" "),
                        function () {}
                      );
                    }
                  );
                });
              });
            }
          );
        });
      });
    });
  }
};
