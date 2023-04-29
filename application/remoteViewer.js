const { desktopCapturer, screen, app, ipcMain } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");

//const robot = require("robotjs");

// My Modules
const info = require("./config");

class RemoteControl {
  constructor() {
    this.mainWindow;
  }
  getCamDataWeb = (data) => {
    this.mainWindow.webContents.send("camStart", data);
  };

  getScreenData = (data) => {
    (async () => {
      let sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: {
          width: parseInt(data.dimension.split("x")[0]),
          height: parseInt(data.dimension.split("x")[1]),
        },
      });

      data["src"] = sources[data.screen].thumbnail.toDataURL();
      this.socket.emit("screenshotResponse", data);
    })();
  };

  findComparedPosition = (data) => {
    return {
      x:
        data.mousePosition.x *
        (screen.getAllDisplays()[data.screen].size.width /
          data.webScreen.width),
      y:
        data.mousePosition.y *
        (screen.getAllDisplays()[data.screen].size.height /
          data.webScreen.height),
    };
  };

  start = (mainWindow) => {
    this.mainWindow = mainWindow;

    this.socket = io.connect("http://" + info.host + ":" + info.port);
    this.socket.on("connect", () => {
      this.socket.emit("joinToRoom", { roomName: "terminal-" + info.id });
    });

    this.socket.on("screenshotRequest", (data) => {
      this.getScreenData(data);
    });

    this.socket.on("camShotRequest", (data) => {
      this.getCamDataWeb(data);
    });

    ipcMain.on("cam", (event, args) => {
      socket.emit("camShotResponse", args);
    });

    this.socket.on("getRunRequest", (data) => {
      child_process.exec(data.cmd, { shell: true }, (err, stdout, stderr) => {
        if (err) {
          data["cmd"] = "err: " + err;
        } else if (stderr) {
          data["cmd"] = "stderr: " + stderr;
        } else {
          data["cmd"] = stdout;
        }

        this.socket.emit("getRunResponse", data);
      });
    });
    this.socket.on("mousemove", (data) => {
      data["compared"] = this.findComparedPosition(data);
      data["screen_resolition"] = screen.getAllDisplays()[data.screen].size;
      //robot.moveMouse(data.compared.x, data.compared.y);
    });
    this.socket.on("click", (data) => {
      //robot.mouseClick()
    });
  };
}

module.exports = new RemoteControl();
