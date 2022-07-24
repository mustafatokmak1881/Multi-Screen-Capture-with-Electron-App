
const info = { port: 3001 }
const path = require("path");
const app = require("express")();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
    maxHttpBufferSize: "1e8",
    pingTimeout: 60000,
    cors: {
        origin: "*"
    }
});

// ExpressJS Module Codes
app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../www/"+ req.params[0]));
});

// Socket.IO Module Codes
io.on("connection", socket => {
    console.log("Connected: " + socket.id);
    socket.on("disconnect", () => {
        console.log("Disconnected: " + socket.id);
    });
    socket.on("joinToRoom", data => {
        socket.join(data.roomName);
        console.log("---> [" + socket.id + "] connected to [" + data.roomName + "]");
    });
    socket.on("screenListRequest", data => {
        io.to(data.from).emit("screenListRequest", data);
    });
    socket.on("screenListResponse", data => {
        io.to(data.to).emit("screenListResponse", data);
    });
    socket.on("mousemove", data => {
        io.to(data.from).emit("mousemove", data);
    });
});

// Http Modules Codes
httpServer.listen(info.port, () => {
    console.log("Listening *: " + info.port);
});
