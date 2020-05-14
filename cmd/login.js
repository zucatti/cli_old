module.exports = function (args, root) {
    var shelljs = require('shelljs');
    const os = require('os');
    var chalk = require('chalk');
    var fs = require('fs');
    var boxen = require('boxen');
    var error = require('../lib/utils/error');
    var logSymbols = require('log-symbols');
    var crypto = require('crypto');
    var inquirer = require('inquirer');

    var request = require('request');
    var Request;
    var manager, sandbox;

    if (global.config.proxy) var Request = request.defaults({
        'proxy': global.config.proxy
    });
    else Request = request;

    console.log(boxen(chalk.cyan(' LOGIN '), { borderStyle: 'round', float: "center", borderColor: "cyan" }));

    fs.stat(root + '/.login', function (e, s) {
        if (s) return console.log('\t' + logSymbols.success + '  You are already logged in (' + chalk.bold(global.cfg.manager) + ').\n');
        if (args.length == 0) manager = "manager.omneedia.com"; else manager = args[0];
        if (manager.indexOf(':') > -1) sandbox = "http://" + manager + "/login"; else sandbox = "https://" + manager + "/login";
        console.log('\n\tPlease log into your Omneedia account.');
        console.log("\tIf you don't have one yet, create yours by running: " + chalk.cyan.underline("https://console.omneedia.com"));
        console.log(" ");

        var questions = [{
            type: 'input',
            name: 'userid',
            message: '\tUser ID:'
        }, {
            type: 'password',
            name: 'password',
            message: '\tPassword:'
        }];
        inquirer.prompt(questions).then(function (answers) {
            Request({
                url: sandbox,
                form: {
                    l: answers.userid,
                    p: crypto.createHash('md5').update(answers.password).digest("hex"),
                    u: sandbox.replace('/login', '')
                },
                method: "post",
                encoding: null
            }, function (err, resp, body) {

            });
        });
    });
}