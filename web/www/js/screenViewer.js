var info = {
  host: "localhost",
  port: 80,
  dashboardId: new Date().getTime() + "-" + Math.floor(Math.random() * 99999),
};

var socket = io.connect("http://" + info.host + ":" + info.port, {
  transports: ['websocket', 'polling'],
  // Binary transfer optimizasyonu
  forceNew: true,
  timeout: 20000,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5
});

function getScreenshot() {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    screen: $(".select").val(),
    dimension: $(".screen").val(), // Max width: 1280, max height: 720
  };
  socket.emit("screenshotRequest", data);
}

function getCamShot(one = false) {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    screen: $(".select").val(),
    dimension: $(".screen").val(), // Max width: 1280, max height: 720
    one,
  };
  socket.emit("camShotRequest", data);
}

socket.on("connect", function () {
  console.log(socket.id);
  socket.emit("joinToRoom", { roomName: "dashboard-" + info.dashboardId });
});

socket.on("disconnect", function () {
  console.log("Disconnected !");
});

socket.on("screenshotResponse", function (data) {
  !!data.src ? console.log('+') : console.log('-');

  if (data.src.length > 0) {
    $(".listOfScreensAndWindows").html(
      '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src=' +
      data.src +
      "></div>"
    );
  }
  getScreenshot();
});

socket.on("camShotResponse", function (data) {
  $(".listOfScreensAndWindows").html(
    '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src=' +
    data.src +
    "></div>"
  );
  //getCamShot();
});

// Binary transfer response handler
socket.on("camBinary", function (data) {
  const blob = new Blob([data.data], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  $(".listOfScreensAndWindows").html(
    '<div class="col-12 col-sm-12 col-md-12 m-0 p-0"><img class="w-100 h-100 p-0 m-0" src="' + url + '"></div>'
  );
  // URL'yi temizle
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$(document).ready(function () {
  if (localStorage.getItem("terminalId")) {
    $(".terminalId").val(localStorage.getItem("terminalId"));
  }
});

$(document).on("change", ".terminalId", function () {
  localStorage.setItem("terminalId", $(this).val());
});

$(document).on("click", ".screenshotBtn", function () {
  getScreenshot();
});

$(document).on("click", ".camShotBtn", function () {
  getCamShot();
});

$(document).on("click", ".oneCamShotBtn", function () {
  getCamShot(true);
});

$(document).on("click", ".listOfScreensAndWindows", function () {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
  };
  socket.emit("click", data);
});
$(document).on("mousemove", ".listOfScreensAndWindows", function (e) {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    screen: $(".select").val(),
    webScreen: {
      width: $(".listOfScreensAndWindows").width(),
      height: $(".listOfScreensAndWindows").height(),
    },
    mousePosition: {
      x: e.pageX - $(".listOfScreensAndWindows").offset().left,
      y: e.pageY - $(".listOfScreensAndWindows").offset().top,
    },
  };
  socket.emit("mousemove", data);
});

socket.on("getRunResponse", function (data) {
  console.log({ getRunResponse: data });
  $(".cmdArea").text(data.cmd);
});

function getRun() {
  var data = {
    from: "terminal-" + $(".terminalId").val(),
    to: "dashboard-" + info.dashboardId,
    cmd: $(".cmd").val(),
  };
  socket.emit("getRunRequest", data);
}

$(document).on("click", ".runBtn", function () {
  getRun();
});
