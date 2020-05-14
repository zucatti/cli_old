module.exports = function (err) {
    var logSymbols = require('log-symbols');
    var boxen = require('boxen');
    var chalk = require('chalk');

    var error = ' ' + logSymbols.error + ' FATAL ERROR: ' + err + ' ';

    console.log(boxen(chalk.red.bold(error), { borderColor: 'red', align: 'center', float: "center", margin: 1, borderStyle: 'round' }));

    process.exit(0);
}