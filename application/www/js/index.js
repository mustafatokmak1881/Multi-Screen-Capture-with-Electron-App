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
const fps = 100;

camStart = (data) => {
  console.log({ data });

  document.getElementById("webcam").attributes.width.nodeValue = parseInt(
    parseInt(data.dimension.split("x")[0] / 5)
  );
  document.getElementById("webcam").attributes.height.nodeValue = parseInt(
    parseInt(data.dimension.split("x")[1] / 5)
  );

  setInterval(() => {
    var pic = webcam.snap();
    document.getElementById("pic").src = pic;
    data["src"] = pic;
    ipcRenderer.send("cam", data);
  }, fps);
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
