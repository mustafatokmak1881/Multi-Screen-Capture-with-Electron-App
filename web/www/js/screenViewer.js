
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
        screen:0
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
    var imagesPool = "";
    if (data.sources) {
        data.sources.forEach(function (value, key) {
            imagesPool += '<div class="col-12 col-sm-12 col-md-12 mt-2 mb-2"><img class="w-100 h-100" src=' + value.src + '></div>';
        });

        $(".listOfScreensAndWindows").html(imagesPool);
        //setTimeout(function(){
            getScreenList();
        //}, 500);
    }
});

$(document).on("click", ".getScreenList", function () {
    getScreenList();
});

$(document).on("mousemove", function(event){
    var data = {
        from: "terminal-" + $(".terminalId").val(),
        to: "dashboard-" + info.dashboardId,
        data: {x: event.pageX, y: event.pageY}
    };
    socket.emit("mousemove", data);
});