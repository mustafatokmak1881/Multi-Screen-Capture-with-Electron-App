
var info = {
    host: "192.168.1.153",
    port: 3001,
    dashboardId: new Date().getTime() + "-" + Math.floor(Math.random() * 99999)
}

var socket = io.connect("http://" + info.host + ":" + info.port);


function getScreenList() {
    var data = {
        from: "terminal-" + $(".terminalId").val(),
        to: "dashboard-" + info.dashboardId,
        screen: 0,
        dimension: "960x540" // Max width: 1280, max height: 720
    };
    socket.emit("screenListRequest", data);
}

socket.on("connect", function () {
    console.log(socket.id);
    socket.emit("joinToRoom", { roomName: "dashboard-" + info.dashboardId });
});

socket.on("disconnect", function () {
    console.log("Disconnected !");
});

socket.on("screenListResponse", function (data) {
    $(".listOfScreensAndWindows").html('<div class="col-12 col-sm-12 col-md-12 mt-2 mb-2"><img class="w-100 h-100" src=' + data.src + '></div>');
      getScreenList();
});

$(document).on("click", ".getScreenList", function () {
    getScreenList();
});



/*
$(document).on("mousemove", function(event){
    var data = {
        from: "terminal-" + $(".terminalId").val(),
        to: "dashboard-" + info.dashboardId,
        data: {x: event.pageX, y: event.pageY}
    };
    socket.emit("mousemove", data);
});

*/