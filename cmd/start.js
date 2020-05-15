module.exports = function (args, root) {
  var boxen = require("boxen");
  var chalk = require("chalk");
  var fs = require("fs");
  var yaml = require("yaml");
  var error = require("../lib/utils/error");
  var upload_dir = root + "/uploads";
  var session_dir = root + "/sessions";
  var updateApp = require("../lib/update-app");
  var findUp = require("find-up");

  const { fork } = require("child_process");

  global.project = {
    home: global.dir,
  };

  global.project.bin = global.dir + "/bin";
  global.project.api = global.project.home + "/services";
  global.project.res = global.project.home + "/resources";
  global.project.culture = global.project.home + "/culture";
  global.project.auth = global.project.home + "/auth";
  global.project.system = global.project.home + "/system";
  global.project.io = global.project.home + "/io";
  findUp("manifest.yaml").then(function (test) {
    if (!test) return error("You must be inside an omneedia project directory");
    fs.readFile(test, "utf-8", function (e, r) {
      global.manifest = yaml.parse(r);
      console.log(
        boxen(chalk.cyan(" " + manifest.namespace + " "), {
          float: "center",
          borderStyle: "round",
          borderColor: "cyan",
        })
      );

      updateApp(function () {
        console.log("\n- Starting " + chalk.bold(manifest.namespace));
        console.log("  " + chalk.cyan(manifest.title));
        console.log("  " + chalk.cyan(manifest.description));
        console.log("  " + chalk.cyan(manifest.copyright));
        console.log("  version " + chalk.cyan.bold(manifest.version));
        console.log("");
        var server = __dirname + "/../lib/server";
        const forked = fork(server + "/server.js", process.argv, {
          env: {
            dir: global.dir,
            config: JSON.stringify(global.config),
            upload_dir: upload_dir,
            session_dir: session_dir,
          },
        });
      });
    });
  });
};
