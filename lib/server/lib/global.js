module.exports = function (app, express) {
    var sep = "/";
    return {
        using: function (unit) {
            var builtin = [
                "rxjs",
                "assert",
                "buffer",
                "child_process",
                "cluster",
                "crypto",
                "dgram",
                "dns",
                "events",
                "fs",
                "http",
                "https",
                "net",
                "os",
                "path",
                "querystring",
                "readline",
                "stream",
                "string_decoder",
                "timers",
                "tls",
                "tty",
                "url",
                "util",
                "v8",
                "vm",
                "zlib",
                "db"
            ];
            //built in classes
            if (builtin.indexOf(unit) > -1) {
                if (unit == "db") unit = "@omneedia/db";
                return require(unit);
            };
            return require(global.project.bin + sep + 'node_modules' + sep + unit);
        }
    }
}