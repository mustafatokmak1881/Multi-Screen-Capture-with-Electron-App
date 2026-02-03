const RemoteTerminalClient = require("rct-client");

const client = new RemoteTerminalClient({
  host: "umaigames.com",
  port: 3011,
});

client.connect();