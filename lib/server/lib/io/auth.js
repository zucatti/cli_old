module.exports = function (socket, app, express, io, ENVIRONMENT) {
  (async () => {
    for await (let response of socket.receiver("#login")) {
      socket.setAuthToken({
        user: JSON.parse(response),
      });
      socket.emit("login", "ok");
    }
  })();
  (async () => {
    for await (let { socket } of io.listener("disconnection")) {
      console.log("   disconnected client #" + socket.id);
    }
  })();
};
