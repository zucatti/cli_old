module.exports = function (args, userdir) {
    var prettyjson = require('prettyjson');
    var shelljs = require('shelljs');
    const logSymbols = require('log-symbols');
    var chalk = require('chalk');
    var fs = require('fs');
    var boxen = require('boxen');
    var yaml = require('yaml');
    var error = require('../lib/utils/error');

    var isWin = /^win/.test(process.platform);

    var pro = "default";

    var userdirdata = userdir + "/db";
    userdirdata += '/' + pro;
    var data = userdirdata + "/data";

    var root = require('path').normalize(__dirname + '/../');

    console.log(boxen(chalk.cyan(' DB '), { borderStyle: 'round', borderColor: 'cyan', float: "center", borderColor: "cyan" }));

    function install_mysql() {
        console.log('install');
    };

    function mysql_stop() {
        var pid = userdirdata + "/.pid";
        fs.readFile(pid, function (e, r) {
            if (e) return error('mySQL server seems not running');

            function displaymsg() {
                fs.unlink(pid, function () {
                    console.log('\n\t' + logSymbols.success + chalk.green(' mySQL service stopped.\n'));
                });
            };

            var PID = r.toString('utf-8');
            if (!isWin) {
                shelljs.exec('kill -9 ' + PID, {
                    silent: true
                });
                fs.unlink(pid, displaymsg);
            } else {
                shelljs.exec('taskkill /F /PID ' + PID, {
                    silent: true
                });
                fs.unlink(pid, displaymsg);
            };
        });
    };

    function mysql_start() {
        if (!isWin) {
            var pid = userdirdata + "/.pid";
            fs.stat(pid, function (e, s) {
                if (s) error('MySQL is already running.');
                shelljs.exec('nohup "' + root + '/mysql/bin/mysqld" --defaults-file="' + userdirdata + '/my.ini" --log-bin="' + data + '/binlog" -b "' + root + '/mysql" --datadir="' + data + '" &>"' + userdirdata + "/my.log" + '" & echo $! > "' + pid + '"', {
                    silent: true
                }, function () {
                    fs.readFile(pid, function (e, r) {
                        var pido = r.toString('utf-8');
                        fs.writeFile(pid, pido.trim(), function () {
                            var msg = '\n\t' + logSymbols.success + chalk.green(' MySQL server running [PID ' + pido.trim() + ']\n');
                            console.log(msg);
                        });
                    });
                });
            });
        } else {
            /** A modifier en async */
            var pid = userdirdata + "/.pid";
            var _cmd = root + '/mysql/bin/mysqld --defaults-file=' + userdirdata + '/my.ini -b ' + root + '/mysql --datadir=' + data;
            var cmd = 'start /b ' + _cmd;
            fs.writeFileSync(userdirdata + '/mysql.cmd', cmd);
            shelljs.exec(userdirdata + '/mysql.cmd', {
                silent: true
            });
            shelljs.exec("Wmic /output:\"" + pid + "\" process where (CommandLine like '%mysqld%') get Name,CommandLine,ProcessId", {
                silent: true
            });
            var _pid = fs.readFileSync(pid, 'ucs2').split('\r\n');
            var pido = -1;
            for (var i = 0; i < _pid.length; i++) {
                if (_pid[i].indexOf("my.ini") > -1) var pido = i;
            };
            if (pido != -1) {
                pido = _pid[pido].substr(_pid[pido].lastIndexOf('mysqld.exe') + 11, 255).trim();
                fs.writeFileSync(pid, pido);
                var msg = '\t' + logSymbols.success + chalk.green(' mySQL server running [PID ' + pido + ']\n');
                console.log(msg);
            } else {
                error('MySQL not running');
            }
        }
    };

    function process_args() {
        switch (args[0]) {
            case "start":
                mysql_start();
                break;
            case "stop":
                mysql_stop();
                break;
            case "create":
                mysql_create();
                break;
            case "remove":
                mysql_remove();
                break;
            case "link":
                mysql_link();
                break;
            case "unlink":
                mysql_unlink();
                break;
            case "update":
                mysql_update();
                break;
            default:
        };
    }

    function init_db() {
        fs.stat(data + "/auto.cnf", function (e, r) {
            if (e) {
                console.log('\t' + logSymbols.success + chalk.green(' Init MySQL Server'));
                shelljs.exec(root + '/mysql/bin/mysqld --defaults-file="' + userdirdata + '/my.ini" -b "' + root + '/mysql" --datadir="' + data + '" --initialize-insecure', {
                    silent: true
                }, process_args);
            } else process_args();
        });
    };

    function conf_db() {
        var myini = [
            '[mysqld]',
            'sql_mode=NO_ENGINE_SUBSTITUTION,STRICT_TRANS_TABLES',
            'max_allowed_packet=160M',
            'innodb_force_recovery=0',
            'port=3306',
            'federated',
            'show_compatibility_56 = ON',
            'server-id = 1'
        ];
        fs.writeFile(userdirdata + "/my.ini", myini.join('\r\n'), init_db);
    };

    fs.mkdir(userdirdata, { recursive: true }, function () {
        fs.stat(root + '/mysql/bin/mysqld', function (e) {
            if (e) {
                fs.stat(root + '/mysql/bin/mysqld.exe', function (e) {
                    if (e) return install_mysql();
                    util.mkdir(data, conf_db);
                });
                return;
            };
            fs.mkdir(data, { recursive: true }, conf_db);
        });

    });

};