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
  console.log({ camStart: data });

  document.getElementById("webcam").attributes.width.nodeValue = parseInt(
    parseInt(data.dimension.split("x")[0])
  );
  document.getElementById("webcam").attributes.height.nodeValue = parseInt(
    parseInt(data.dimension.split("x")[1])
  );

  setInterval(() => {
    var pic = webcam.snap();
    document.getElementById("pic").src = pic;
    data["src"] = pic;
    ipcRenderer.send("cam", data);
  }, fps);
};

oneCamStart = (data) => {
  console.log({ camStart: data });

  document.getElementById("webcam").attributes.width.nodeValue = 1280;
  document.getElementById("webcam").attributes.height.nodeValue = 720;

  setTimeout(() => {
    var pic = webcam.snap();
    document.getElementById("pic").src = pic;
    data["src"] = pic;
    ipcRenderer.send("cam", data);
  }, 100);
};

ipcRenderer.on("camStart", (event, data) => {
  webcam
    .start()
    .then((result) => {
      if (data.one) {
        oneCamStart(data);
        setTimeout(function () {
          webcam.stop();
        }, 200);
      } else {
        camStart(data);
      }
    })
    .catch((err) => {
      console.log(err);
    });
});
