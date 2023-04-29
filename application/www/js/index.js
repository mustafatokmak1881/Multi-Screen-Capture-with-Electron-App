const { ipcRenderer } = require("electron");
const webcamElement = document.getElementById("webcam");
const canvasElement = document.getElementById("canvas");
const snapSoundElement = document.getElementById("snapSound");
const webcam = new Webcam(
  webcamElement,
  "user",
  canvasElement,
  snapSoundElement
);
let data = [];

camStart = (data) => {
  setInterval(() => {
    var pic = webcam.snap();
    document.getElementById("pic").src = pic;
    data["src"] = pic;
    ipcRenderer.send("cam", data);
  }, 2000);
};

ipcRenderer.on("camStart", (event, data) => {
  webcam
    .start()
    .then((result) => {
      camStart(data);
    })
    .catch((err) => {
      console.log(err);
    });
});
