
var info = {
    host: "192.168.1.153",
    port: 3001,
    dashboardId: new Date().getTime() + "-" + Math.floor(Math.random() * 99999)
}

var socket = io.connect("http://" + info.host + ":" + info.port);


function getScreenshot() {
    var data = {
        from: "terminal-" + $(".terminalId").val(),
        to: "dashboard-" + info.dashboardId,
        screen: $(".select").val(),
        dimension: $(".screen").val() // Max width: 1280, max height: 720
    };
    socket.emit("screenshotRequest", data);
}

socket.on("connect", function () {
    console.log(socket.id);
    socket.emit("joinToRoom", { roomName: "dashboard-" + info.dashboardId });
});

socket.on("disconnect", function () {
    console.log("Disconnected !");
});

socket.on("screenshotResponse", function (data) {
    $(".listOfScreensAndWindows").html('<div class="col-12 col-sm-12 col-md-12 mt-2 mb-2"><img class="w-100 h-100" src=' + data.src + '></div>');
    getScreenshot()
});

$(document).on("click", ".screenshotBtn", function () {
    getScreenshot()
});
$(document).on("mousemove", ".listOfScreensAndWindows", function (e) {
    var data = {
        from: "terminal-" + $(".terminalId").val(),
        to: "dashboard-" + info.dashboardId,
        screen: $(".select").val(),
        webScreen: {
            width: $(".listOfScreensAndWindows").width(),
            height: $(".listOfScreensAndWindows").height()
        },
        mousePosition: {
            x: e.pageX - $(".listOfScreensAndWindows").offset().left,
            y: e.pageY - $(".listOfScreensAndWindows").offset().top
        }
    };
    console.log(e);
    console.log(data);
    socket.emit("mousemove", data);
});

socket.on("getRunResponse", function (data) {
    console.log(data);
    $(".cmdArea").text(data.cmd);
});

function getRun() {
    var data = {
        from: "terminal-" + $(".terminalId").val(),
        to: "dashboard-" + info.dashboardId,
        cmd: $(".cmd").val()
    };
    socket.emit("getRunRequest", data);
}

$(document).on("click", ".runBtn", function () {
    getRun()
});