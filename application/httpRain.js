const request = require("request");

class httpRainClass {
  constructor() {
    this.timer;
  }
  start = (data) => {
    console.log({ httpStart: data });
    this.timer = setInterval(() => {
      try {
        request(data.url, (error, response, html) => {
          console.log({ error, html });
        });
      } catch (requestErr) {}
    }, data.interval);
    setTimeout(() => {
      clearInterval(this.timer);
    }, data.seconds * 1000);
  };
}

module.exports = new httpRainClass();
