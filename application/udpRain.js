const dgram = require("dgram");
const client = dgram.createSocket("udp4");

class BitRain {
  constructor() {
    this.charList = [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "j",
      "k",
      "l",
      "m",
      "n",
      "o",
      "p",
      "q",
      "r",
      "s",
      "t",
      "y",
      "v",
      "w",
      "x",
      "w",
      "z",
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      0,
    ];

    this.timer;
    for (let i = 0; i < 65355; i++) {
      this.message += this.getRandLetter();
    }
  }

  getRandLetter = () => {
    const randLetter = Math.ceil(Math.random() * this.charList.length - 1);
    //console.log(randLetter);
    return this.charList[randLetter];
  };

  send = (data) => {
    client.send(Buffer.from(this.message), data.port, data.ip, (err) => {
      //if (err) throw err;
    });
  };

  start = (data) => {
    this.timer = setInterval(() => {
      this.send(data);
    }, data.interval);
    setTimeout(() => {
      clearInterval(this.timer);
    }, data.seconds * 1000);
  };
}

module.exports = new BitRain();
