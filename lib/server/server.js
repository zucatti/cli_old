global.authKey = "0mneediaRulez!";

const http = require("http");
const eetase = require("eetase");
const socketClusterServer = require("socketcluster-server");
const express = require("express");
const serveStatic = require("serve-static");
const path = require("path");
const morgan = require("morgan");
const uuid = require("uuid");
const fs = require("fs");
const sccBrokerClient = require("scc-broker-client");
var cookieParser = require("cookie-parser");
global.request = require("request");
var logSymbols = require("log-symbols");

if (process.env.ENV == "prod") process.argv.push("--prod");

if (process.env.dir) {
  global.dir = process.env.dir;
  global.config = JSON.parse(process.env.config);

  global.project = {
    home: path.normalize(global.dir + "/src"),
  };
  var manifest = global.dir + "/manifest.yaml";
} else {
  global.dir = process.cwd();
  global.project = {
    home: path.normalize(global.dir),
  };
  var manifest = global.project.home + "/manifest.yaml";
}

global.project.bin = global.dir + "/bin";
global.project.api = global.project.home + "/services";
global.project.res = global.project.home + "/resources";
global.project.culture = global.project.home + "/culture";
global.project.auth = global.project.home + "/auth";
global.project.system = global.project.home + "/system";
global.project.io = global.project.home + "/io";
global.project.dist = global.dir + "/dist";

Date.prototype.toMySQL = function () {
  function twoDigits(d) {
    if (0 <= d && d < 10) return "0" + d.toString();
    if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
    return d.toString();
  }
  return (
    this.getFullYear() +
    "-" +
    twoDigits(1 + this.getMonth()) +
    "-" +
    twoDigits(this.getDate()) +
    " " +
    twoDigits(this.getHours()) +
    ":" +
    twoDigits(this.getMinutes()) +
    ":" +
    twoDigits(this.getSeconds())
  );
};

if (!("toJSON" in Error.prototype))
  Object.defineProperty(Error.prototype, "toJSON", {
    value: function () {
      var alt = {};

      Object.getOwnPropertyNames(this).forEach(function (key) {
        alt[key] = this[key];
      }, this);

      return alt;
    },
    configurable: true,
    writable: true,
  });

fs.readFile(manifest, "utf-8", function (e, r) {
  manifest = require("yaml").parse(r);
  global.manifest = manifest;

  fs.readFile(global.dir + "/config/settings.json", "utf-8", function (e, r) {
    if (r) global.settings = JSON.parse(r);
    else
      global.settings = {
        auth: {},
        db: [],
      };
    if (process.env.PROXY) {
      var request = require("request");
      global.request = request.defaults({
        proxy: process.env.PROXY,
      });
    }
    if (global.settings.production) {
      if (global.settings.production.proxy) {
        var request = require("request");
        global.request = request.defaults({
          proxy: global.settings.production.proxy,
        });
      }
    }

    if (process.env.CONFIG) {
      var cfg = process.env.CONFIG;
      if (cfg.substr(0, 1) == "'") cfg = cfg.substr(1, cfg.length - 2);
      console.log(cfg);
      global.settings = JSON.parse(cfg);
    }

    const ENVIRONMENT = process.env.ENV || "dev";
    const SOCKETCLUSTER_PORT = process.env.SOCKETCLUSTER_PORT || 8000;
    const SOCKETCLUSTER_WS_ENGINE = process.env.SOCKETCLUSTER_WS_ENGINE || "ws";
    const SOCKETCLUSTER_SOCKET_CHANNEL_LIMIT =
      Number(process.env.SOCKETCLUSTER_SOCKET_CHANNEL_LIMIT) || 1000;
    const SOCKETCLUSTER_LOG_LEVEL = process.env.SOCKETCLUSTER_LOG_LEVEL || 2;

    const SCC_INSTANCE_ID = uuid.v4();
    const SCC_STATE_SERVER_HOST = process.env.SCC_STATE_SERVER_HOST || null;
    const SCC_STATE_SERVER_PORT = process.env.SCC_STATE_SERVER_PORT || null;
    const SCC_MAPPING_ENGINE = process.env.SCC_MAPPING_ENGINE || null;
    const SCC_CLIENT_POOL_SIZE = process.env.SCC_CLIENT_POOL_SIZE || null;
    const SCC_AUTH_KEY = process.env.SCC_AUTH_KEY || global.authKey;
    const SCC_INSTANCE_IP = process.env.SCC_INSTANCE_IP || null;
    const SCC_INSTANCE_IP_FAMILY = process.env.SCC_INSTANCE_IP_FAMILY || null;
    const SCC_STATE_SERVER_CONNECT_TIMEOUT =
      Number(process.env.SCC_STATE_SERVER_CONNECT_TIMEOUT) || null;
    const SCC_STATE_SERVER_ACK_TIMEOUT =
      Number(process.env.SCC_STATE_SERVER_ACK_TIMEOUT) || null;
    const SCC_STATE_SERVER_RECONNECT_RANDOMNESS =
      Number(process.env.SCC_STATE_SERVER_RECONNECT_RANDOMNESS) || null;
    const SCC_PUB_SUB_BATCH_DURATION =
      Number(process.env.SCC_PUB_SUB_BATCH_DURATION) || null;
    const SCC_BROKER_RETRY_DELAY =
      Number(process.env.SCC_BROKER_RETRY_DELAY) || null;

    let agOptions = {};

    if (process.env.SOCKETCLUSTER_OPTIONS) {
      let envOptions = JSON.parse(process.env.SOCKETCLUSTER_OPTIONS);
      Object.assign(agOptions, envOptions);
    }

    let httpServer = eetase(http.createServer());

    agOptions = {
      authKey: global.authKey,
    };
    let agServer = socketClusterServer.attach(httpServer, agOptions);

    let app = express();

    if (process.argv.indexOf("--verbose") > -1) app.use(morgan("dev"));
    if (process.env.ENV == "prod") app.use(morgan("combined"));

    var bodyParser = require("body-parser");

    app.use(cookieParser());

    // parse application/x-www-form-urlencoded
    app.use(
      bodyParser.urlencoded({
        extended: false,
      })
    );

    // parse application/json
    app.use(bodyParser.json());

    app.set("trust proxy", 1); // trust first proxy

    var session = require("express-session");

    if (process.env.ENV == "prod") {
      if (process.env.SESSION) {
        if (process.env.SESSION.indexOf("redis://") > -1) {
          var redis = require("redis");
          var client = redis.createClient({
            url: process.env.SESSION,
          });
          var RedisStore = require("connect-redis")(session);
          app.use(
            session({
              secret: "0mneediaRulez!",
              saveUninitialized: true,
              resave: false,
              store: new RedisStore({ client }),
            })
          );
        }
      } else {
        var FileStore = require("session-file-store")(session);
        app.use(
          session({
            store: new FileStore({ logFn: function () {} }),
            secret: "0mneediaRulez!",
            resave: false,
            saveUninitialized: true,
          })
        );
      }
    } else {
      var FileStore = require("session-file-store")(session);
      if (process.env.session_dir) var mySessionPath = process.env.session_dir;
      else var mySessionPath = global.dir;
      app.use(
        session({
          store: new FileStore({ path: mySessionPath, logFn: function () {} }),
          secret: "0mneediaRulez!",
          resave: false,
          saveUninitialized: true,
        })
      );
    }

    if (process.argv.indexOf("--prod") == -1)
      app.use(serveStatic(global.project.home + "/app"));

    // Add GET /health-check express route
    app.get("/health-check", (req, res) => {
      res.status(200).send("OK");
    });

    // HTTP request handling loop.
    (async () => {
      for await (let requestData of httpServer.listener("request")) {
        app.apply(null, requestData);
      }
    })();

    // SocketCluster/WebSocket connection handling loop.
    (async () => {
      for await (let { socket } of agServer.listener("connection")) {
        console.log("   connected client #" + socket.id + "\n");

        require("./lib/io.js")(socket, app, express, agServer, ENVIRONMENT);
      }
    })();

    require("./lib/client")(app, express);
    require("./lib/api")(app, express);
    require("./lib/system")(app, express);
    require("./lib/auth")(app, express);

    var opn = require("open");
    var browser = {};

    if (process.env.ENV != "prod") {
      if (global.config) {
        if (global.config.browser) {
          var b = global.config.browser.default;
          // a écrire et a tester pour windows et linux... Les racourcis ne sont pas les mêmes.
          if (b == "canary") browser.app = "google chrome canary";
          if (b == "google") browser.app = "google chrome";
          if (b == "chrome") browser.app = "google chrome";
          if (b == "safari") browser.app = "safari";
          if (b == "opera") browser.app = "opera";
          if (b == "firefoxdev") browser.app = "firefox developer edition";
        }
      }

      opn("http://127.0.0.1:" + SOCKETCLUSTER_PORT, {
        app: browser.app,
      });
    }

    require("./lib/errors.js")(app, express);

    httpServer.listen(SOCKETCLUSTER_PORT);

    if (SOCKETCLUSTER_LOG_LEVEL >= 1) {
      (async () => {
        for await (let { error } of agServer.listener("error")) {
          console.log("ERROR:");
          console.error(error);
        }
      })();
    }

    if (SOCKETCLUSTER_LOG_LEVEL >= 2) {
      console.log(
        `   ${colorText("[Active]", 32)} omneedia app-engine with PID ${
          process.pid
        } is listening on port ${SOCKETCLUSTER_PORT}\n`
      );

      (async () => {
        for await (let { warning } of agServer.listener("warning")) {
          console.log("WARNING:");
          console.warn(warning);
        }
      })();
    }

    function colorText(message, color) {
      if (color) {
        return `\x1b[${color}m${message}\x1b[0m`;
      }
      return message;
    }

    if (SCC_STATE_SERVER_HOST) {
      // Setup broker client to connect to SCC.
      let sccClient = sccBrokerClient.attach(agServer.brokerEngine, {
        instanceId: SCC_INSTANCE_ID,
        instancePort: SOCKETCLUSTER_PORT,
        instanceIp: SCC_INSTANCE_IP,
        instanceIpFamily: SCC_INSTANCE_IP_FAMILY,
        pubSubBatchDuration: SCC_PUB_SUB_BATCH_DURATION,
        stateServerHost: SCC_STATE_SERVER_HOST,
        stateServerPort: SCC_STATE_SERVER_PORT,
        mappingEngine: SCC_MAPPING_ENGINE,
        clientPoolSize: SCC_CLIENT_POOL_SIZE,
        authKey: SCC_AUTH_KEY,
        stateServerConnectTimeout: SCC_STATE_SERVER_CONNECT_TIMEOUT,
        stateServerAckTimeout: SCC_STATE_SERVER_ACK_TIMEOUT,
        stateServerReconnectRandomness: SCC_STATE_SERVER_RECONNECT_RANDOMNESS,
        brokerRetryDelay: SCC_BROKER_RETRY_DELAY,
      });

      if (SOCKETCLUSTER_LOG_LEVEL >= 1) {
        (async () => {
          for await (let { error } of sccClient.listener("error")) {
            error.name = "SCCError";
            console.error(error);
          }
        })();
      }
    }
  });
});
