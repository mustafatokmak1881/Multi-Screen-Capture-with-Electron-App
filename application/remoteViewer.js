
const { desktopCapturer } = require("electron");
const io = require("socket.io-client");

let info = { host: "192.168.1.153", port: 3001, id: 1 }

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
                this.socket.emit("screenListResponse", data);
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

        this.socket.on("screenListRequest", data => {
            console.log( data );
            this.getScreenData(data).then();
        });
    }
}

module.exports = new RemoteControl;