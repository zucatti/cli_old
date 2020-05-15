#!/usr/bin/env node

/*
 * Omneedia
 * One framework to code'em all!
 * Copyright (c) 2017 OmneediaFramework
 */

var chalk = require("chalk");
var figlet = require("figlet");
var findUp = require("find-up");
var fs = require("fs");
var rootOS = require("os").homedir() + "/oa-cli";

var $_VERSION;

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

Object.defineProperty(Error.prototype, "toJSON", {
  configurable: true,
  value: function () {
    var alt = {};
    var storeKey = function (key) {
      alt[key] = this[key];
    };
    Object.getOwnPropertyNames(this).forEach(storeKey, this);
    return alt;
  },
});

var error = require("./lib/utils/error.js");

function parseArgs(c) {
  var cmds = [];
  var cmdo = {};
  function parseCommand(cmd) {
    var args = [];
    if (cmdo[cmd].subcommands) {
      var subcmd = process.argv[process.argv.indexOf(cmd) + 1];
      if (!subcmd) return config(c, cmdo[cmd]);
      for (var i = 0; i < cmdo[cmd].subcommands.length; i++) {
        if (
          cmdo[cmd].subcommands[i].cmd == subcmd ||
          cmdo[cmd].subcommands[i] == subcmd
        ) {
          for (
            var j = process.argv.indexOf(cmd) + 1;
            j < process.argv.length;
            j++
          )
            args.push(process.argv[j]);
          try {
            return require("./cmd/" + cmd)(args, rootOS);
          } catch (e) {
            //console.log(e);
            if (e.code == "MODULE_NOT_FOUND")
              error("module (" + cmd + ") not found");
            else console.log(e);
          }
        }
      }
      return config(c, cmdo[cmd]);
    } else {
      for (var j = process.argv.indexOf(cmd) + 1; j < process.argv.length; j++)
        args.push(process.argv[j]);
      try {
        return require("./cmd/" + cmd)(args, rootOS);
      } catch (e) {
        //console.log(e);
        if (e.code == "MODULE_NOT_FOUND")
          error("module (" + cmd + ") not found");
        else console.log(e);
      }
    }
  }

  for (var el in c) {
    var item = c[el];
    for (var i = 0; i < item.length; i++) {
      cmds.push(item[i].cmd);
      cmdo[item[i].cmd] = item[i];
    }
  }

  for (var i = 0; i < cmds.length; i++) {
    if (process.argv.indexOf(cmds[i]) > -1) return parseCommand(cmds[i]);
  }

  config(c, true);
}

var config = function (config, force) {
  figlet("omneedia", "Ogre", function (e, cl) {
    console.log(chalk.bold("\n        Omneedia CLI v" + $_VERSION));
    console.log(chalk.cyan(cl));
    if (process.argv.length > 0 && !force) return parseArgs(config);

    if (force.cmd) {
      console.log(
        "  " +
          chalk.cyan(force.cmd) +
          chalk.bold(" - " + force.description) +
          "\n"
      );
      if (force.text) {
        var words = force.text.length;
        var ndx = 0;
        while (ndx <= words) {
          process.stdout.write("  " + force.text.substr(ndx, 80) + "\n");
          ndx = ndx + 80;
          txt = "";
        }
        console.log(" ");
      }
      console.log(chalk.bold("  " + "Usage" + ":\n"));
      console.log(
        "    " +
          chalk.hex("#AAAAAA")("$") +
          chalk.cyan(
            " " +
              process.argv[1].substr(
                process.argv[1].lastIndexOf("/") + 1,
                process.argv[1].length
              ) +
              " " +
              force.cmd +
              " <command> "
          ) +
          chalk.hex("#003f3f")(
            "[<args>] [--help] [--verbose] [--quiet] [--no-interactive] [options]\n"
          )
      );

      //for (var el in config) {

      console.log(
        chalk.bold(
          "  " +
            force.cmd.substr(0, 1).toUpperCase() +
            force.cmd.substr(1, force.cmd.length) +
            " commands" +
            ":\n"
        )
      );

      var groups = force.subcommands;
      for (var j = 0; j < groups.length; j++) {
        var obj = groups[j];
        if (!obj.display) obj.display = true;
        if (obj.display) {
          if (obj.subcommands) obj.cmd += " <subcommand>";
          process.stdout.write("    " + chalk.cyan(obj.cmd) + " ");
          for (var i = 0; i < 32 - obj.cmd.length; i++) {
            process.stdout.write(chalk.hex("#AAAAAA")("."));
          }
          var txt = "";
          var txt2 = "";
          if (obj.status) {
            if (obj.status == "experimental")
              txt = chalk.red("(experimental) ");
            if (obj.status == "beta") txt = chalk.magenta("(beta) ");
            if (obj.status == "paid") txt = chalk.green("(paid) ");
          }
          if (obj.subcommands) {
            txt2 = chalk.hex("#AAAAAA")(" subcommands: ");
            for (var k = 0; k < obj.subcommands.length; k++) {
              if (obj.subcommands[k].cmd)
                txt2 += chalk.cyan(obj.subcommands[k].cmd);
              else txt2 += chalk.cyan(obj.subcommands[k]);
              if (k < obj.subcommands.length - 1)
                txt2 += chalk.hex("#AAAAAA")(",");
            }
          }
          if (Array.isArray(obj.description)) {
            for (var i = 0; i < obj.description.length; i++) {
              var str = txt + obj.description[i];
              var words = str.length;
              var ndx = 0;
              if (i > 0)
                process.stdout.write("                                     ");
              while (ndx <= words) {
                if (ndx == 0)
                  process.stdout.write(" " + str.substr(ndx, 61) + "\n");
                if (ndx > 0)
                  process.stdout.write(
                    "                                     " +
                      str.substr(ndx, 61) +
                      "\n"
                  );
                ndx = ndx + 61;
                txt = "";
              }
              if (txt2)
                process.stdout.write(
                  "                                     " + txt2 + "\n"
                );
            }
          } else {
            var str = txt + obj.description;
            var words = str.length;
            var ndx = 0;
            while (ndx <= words) {
              if (ndx == 0)
                process.stdout.write(" " + str.substr(ndx, 61) + "\n");
              if (ndx > 0)
                process.stdout.write(
                  "                                     " +
                    str.substr(ndx, 61) +
                    "\n"
                );
              ndx = ndx + 61;
            }
            if (txt2)
              process.stdout.write(
                "                                     " + txt2 + "\n"
              );
          }
        }
      }
      //};
      return console.log(" ");
    } else {
      console.log(chalk.bold("  " + "Usage" + ":\n"));
      console.log(
        "    " +
          chalk.hex("#AAAAAA")("$") +
          chalk.cyan(
            " " +
              process.argv[1].substr(
                process.argv[1].lastIndexOf("/") + 1,
                process.argv[1].length
              ) +
              " <command> "
          ) +
          chalk.hex("#003f3f")(
            "[<args>] [--help] [--verbose] [--quiet] [--no-interactive] [options]\n"
          )
      );
    }
    for (var el in config) {
      var ik = el.split("|");
      if (ik[1] == "pkg") {
        if (!global.dir)
          config[el] = [
            {
              comments: "You're not inside an omneedia package directory",
            },
          ];
      }
      console.log(chalk.bold("  " + ik[0] + ":\n"));
      var groups = config[el];
      for (var j = 0; j < groups.length; j++) {
        var obj = groups[j];
        if (!obj.display) obj.display = true;
        if (obj.comments) {
          console.log("    " + chalk.hex("#AAAAAA")(obj.comments));
        } else {
          if (obj.display) {
            if (obj.subcommands) obj.cmd += " <subcommand>";
            process.stdout.write("    " + chalk.cyan(obj.cmd) + " ");
            for (var i = 0; i < 32 - obj.cmd.length; i++) {
              process.stdout.write(chalk.hex("#AAAAAA")("."));
            }
            var txt = "";
            var txt2 = "";
            if (obj.status) {
              if (obj.status == "experimental")
                txt = chalk.red("(experimental) ");
              if (obj.status == "beta") txt = chalk.magenta("(beta) ");
              if (obj.status == "paid") txt = chalk.green("(paid) ");
            }
            if (obj.subcommands) {
              txt2 = chalk.hex("#AAAAAA")(" subcommands: ");
              for (var k = 0; k < obj.subcommands.length; k++) {
                if (obj.subcommands[k].cmd)
                  txt2 += chalk.cyan(obj.subcommands[k].cmd);
                else txt2 += chalk.cyan(obj.subcommands[k]);
                if (k < obj.subcommands.length - 1)
                  txt2 += chalk.hex("#AAAAAA")(",");
              }
            }
            if (Array.isArray(obj.description)) {
              for (var i = 0; i < obj.description.length; i++) {
                var str = txt + obj.description[i];
                var words = str.length;
                var ndx = 0;
                if (i > 0)
                  process.stdout.write("                                     ");
                while (ndx <= words) {
                  if (ndx == 0)
                    process.stdout.write(" " + str.substr(ndx, 61) + "\n");
                  if (ndx > 0)
                    process.stdout.write(
                      "                                     " +
                        str.substr(ndx, 61) +
                        "\n"
                    );
                  ndx = ndx + 61;
                  txt = "";
                }
                if (txt2)
                  process.stdout.write(
                    "                                     " + txt2 + "\n"
                  );
              }
            } else {
              var str = txt + obj.description;
              var words = str.length;
              var ndx = 0;
              while (ndx <= words) {
                if (ndx == 0)
                  process.stdout.write(" " + str.substr(ndx, 61) + "\n");
                if (ndx > 0)
                  process.stdout.write(
                    "                                     " +
                      str.substr(ndx, 61) +
                      "\n"
                  );
                ndx = ndx + 61;
              }
              if (txt2)
                process.stdout.write(
                  "                                     " + txt2 + "\n"
                );
            }
          }
        }
      }
    }
    console.log("\n");
  });
};

var commands = require("./lib/cmd.js");
fs.readFile(__dirname + "/package.json", "utf-8", function (e, ab) {
  if (e) return console.log("SYSTEM ERROR");
  try {
    ab = JSON.parse(ab);
    $_VERSION = ab.version;
  } catch (e) {
    return console.log("SYSTEM ERROR");
  }

  fs.mkdir(rootOS, { recursive: true }, function () {
    fs.readFile(rootOS + "/.config", function (e, r) {
      if (e) {
        global.cfg = {
          uid: require("shortid").generate(),
          current: "default",
          default: {},
          configs: ["default"],
        };
        fs.writeFile(
          rootOS + "/.config",
          JSON.stringify(global.cfg),
          function () {
            global.config = global.cfg[global.cfg.current];
            var request = require("request");
            if (global.config.proxy)
              global.request = request.defaults({ proxy: global.config.proxy });
            else global.request = request;
            findUp("manifest.yaml").then(function (test) {
              if (test) global.dir = require("path").dirname(test);
              parseArgs(commands);
            });
          }
        );
      } else {
        global.cfg = JSON.parse(r.toString("utf-8"));
        global.config = global.cfg[global.cfg.current];
        var request = require("request");
        if (global.config.proxy)
          global.request = request.defaults({ proxy: global.config.proxy });
        else global.request = request;
        findUp("manifest.yaml").then(function (test) {
          if (test) global.dir = require("path").dirname(test);
          parseArgs(commands);
        });
      }
    });
  });
});
