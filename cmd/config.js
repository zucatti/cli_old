module.exports = function (args, root) {
    var prettyjson = require('prettyjson');
    var shelljs = require('shelljs');
    const logSymbols = require('log-symbols');
    var chalk = require('chalk');
    var fs = require('fs');
    var boxen = require('boxen');
    var error = require('../lib/utils/error');
    var objectPath = require("object-path");

    function apply_proxy(cb) {
        function config_proxy() {
            var PROXY = global.config['proxy'];
            // set proxy for npm
            shelljs.exec('npm config set proxy ' + PROXY, {
                silent: true, async: true
            }, function () {
                shelljs.exec('npm config set https-proxy ' + PROXY, {
                    silent: true, async: true
                }, function () {
                    // set proxy for git
                    shelljs.exec('git config --global http.proxy ' + PROXY, {
                        silent: true, async: true
                    }, function () {
                        shelljs.exec('git config --global https.proxy ' + PROXY, {
                            silent: true, async: true
                        }, function () {
                            var request = require('request');
                            global.request = request.defaults({ proxy: PROXY });
                            cb();
                        });
                    });
                });
            });
        };

        // unset proxy for npm
        shelljs.exec('npm config delete proxy', {
            silent: true, async: true
        }, function () {
            shelljs.exec('npm config delete https-proxy', {
                silent: true, async: true
            }, function () {
                // unset proxy for git
                shelljs.exec('git config --global core.pager cat', {
                    silent: true, async: true
                }, function () {
                    shelljs.exec('git config --global --unset http.proxy', {
                        silent: true, async: true
                    }, function () {
                        shelljs.exec('git config --global --unset https.proxy', {
                            silent: true, async: true
                        }, function () {
                            global.request = require('request');
                            if (global.config['proxy']) config_proxy(); else cb();
                        });
                    });
                });
            });
        });
    };

    if ((args[0] != "load") && (args[0] != "save")) console.log(boxen(chalk.cyan(' configuration: ' + chalk.cyan.bold(global.cfg.current) + ' '), { float: "center", borderStyle: 'round', borderColor: "cyan" }));

    if (args[0] == 'get') {
        var param = args[args.indexOf('get') + 1];
        if (!param) {
            console.log('\n' + prettyjson.render(global.config));
            console.log(' ');
        } else {
            var value = objectPath.get(global.config, param);
            console.log('\n' + chalk.green(param) + ' = ' + chalk.bold(value));
            console.log(' ');
        };
        for (var i = 0; i < 100; i++) process.stdout.write('_');
        return console.log('\n');
    };

    if (args[0] == 'set') {
        var key = args[args.indexOf('set') + 1];
        var value = args[args.indexOf('set') + 2];
        if (!key) error('You must provide a key');
        if (!value) error('You must provide a value');
        objectPath.set(global.config, key, value);
        global.cfg[global.cfg.current] = global.config;
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function () {
            apply_proxy(function () {
                console.log('\n' + prettyjson.render(global.config));
                console.log(' ');
                console.log(logSymbols.success + chalk.green.bold(' OK. ') + chalk.cyan(key) + ' set to ' + chalk.cyan(value) + '\n');
            });
        });
    };

    if (args[0] == 'unset') {
        var key = args[args.indexOf('unset') + 1];
        if (!key) error('You must provide a key');
        if (!global.config[key]) return error('key: ' + key + ' not found!');
        objectPath.del(global.config, key);
        global.cfg[global.cfg.current] = global.config;
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function () {
            apply_proxy(function () {
                console.log('\n' + prettyjson.render(global.config));
                console.log(' ');
                console.log(logSymbols.success + chalk.green.bold(' OK. ') + chalk.cyan(key) + ' unset' + '\n');
            });
        });
    };

    if (args[0] == 'save') {
        var saver = args[args.indexOf('save') + 1];
        if (!saver) error('You must provide a name');
        if (global.cfg.configs.indexOf(saver) == -1) global.cfg.configs.push(saver);
        global.cfg[saver] = global.config;
        global.config = global.cfg[saver];
        global.cfg.current = saver;
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function () {
            console.log(chalk.green('  saved to ') + chalk.green.bold(saver));
            console.log(' ');
            apply_proxy(function () {
                console.log(boxen(chalk.cyan(' configuration: ' + chalk.cyan.bold(global.cfg.current) + ' '), { borderStyle: 'round', borderColor: "cyan" }));
                console.log('\n' + prettyjson.render(global.config));
                console.log(' ');
            });
        });
    };

    if (args[0] == 'delete') {
        var saver = args[args.indexOf('delete') + 1];
        if (!saver) error('You must provide a name');
        if (global.cfg.configs.indexOf(saver) == -1) error('config not found');
        if (global.cfg.current == saver) error("You can't delete the current config.");
        if (global.cfg.configs.length <= 1) error("You must have at least one config.");
        delete global.cfg[saver];
        global.cfg.configs.remove(saver);
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function () {
            console.log(chalk.green('  deleted. '));
            console.log(' ');
        });
    };

    if (args[0] == 'load') {
        var saver = args[args.indexOf('load') + 1];
        if (!saver) error('You must provide a name');
        if (global.cfg.configs.indexOf(saver) == -1) error('config not found');
        global.config = global.cfg[saver];
        global.cfg.current = saver;
        console.log(boxen(chalk.cyan(' configuration: ' + chalk.cyan.bold(global.cfg.current) + ' '), { borderStyle: 'round', borderColor: "cyan" }));
        fs.writeFile(root + '/.config', JSON.stringify(global.cfg), function () {
            apply_proxy(function () {
                console.log('\n' + prettyjson.render(global.config));
                console.log(' ');
            });
        });
    };

    if (args[0] == 'list') {
        console.log(prettyjson.render(global.cfg.configs));
        console.log(' ');
    };

};