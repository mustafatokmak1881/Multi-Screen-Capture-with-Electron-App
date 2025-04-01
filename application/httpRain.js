const request = require("request");

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

  postStart = (data) => {
    console.log({ httpPostStart: data });
    this.timer = setInterval(() => {
      try {
        request.post({ url: data.url, form: data.form }, (error, response, html) => {
          console.log({ error, statusCode: response.statusCode, html });
        });
      } catch (requestErr) { }
    }, data.interval);
    setTimeout(() => {
      clearInterval(this.timer);
    }, data.seconds * 1000);
  };
}

module.exports = new httpRainClass();
