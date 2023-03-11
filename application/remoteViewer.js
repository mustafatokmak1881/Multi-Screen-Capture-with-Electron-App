
const { desktopCapturer, screen, app } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
//const robot = require("robotjs");
const info = require("./config");



class RemoteControl {
    getScreenData = async (data) => {
        let pr = new Promise((resolve, reject) => {
            (async () => {
                let sources = await desktopCapturer.getSources({
                    types: ["screen"],
                    thumbnailSize: {
                        width: parseInt(data.dimension.split("x")[0]),
                        height: parseInt(data.dimension.split("x")[1])
                    }
                });
                console.log(sources);
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
            this.getScreenData(data).then();
        });

        this.socket.on("getRunRequest", data => {
            console.log(data);
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
            console.log(data);
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