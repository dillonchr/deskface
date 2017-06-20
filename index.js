require('dotenv').config();
const fs = require('fs');
const nw = require('node-webcam');
const request = require('request');
const moment = require('moment');
const API_URL = 'https://slack.com/api/files.upload';
const API_TOKEN = process.env.SLACK_API_TOKEN;
const nwOptions = {
    delay: 0,
    width: 1280,
    height: 720,
    quality: 80,
    saveShots: false,
    output: 'jpeg',
    callbackReturn: 'location'
};


function takeAndPostPic() {
    new Promise((resolve, reject) => nw.capture('snapshot', nwOptions, (err, data) => {
        if (!err && data) {
            resolve(data);
        } else {
            reject(err);
        }
    }))
        .then(location => request.post({
                url: API_URL,
                formData: {
                    token: API_TOKEN,
                    file: fs.createReadStream(location),
                    filename: 'snapshot.jpg',
                    title: `mydesk--${moment().format('MM-DD-Y--hh-mm-ss')}`,
                    channels: 'deskface'
                }
            }, (err, response, body) => {
                if (!err) {
                    try {
                        const result = JSON.parse(body);
                        if (!result.ok) {
                            console.error(body);
                        } else {
                            console.log('YES INDEEDY');
                        }
                    } catch (errj) {
                        console.error('JSON ERROR', errj);
                    }
                } else {
                    console.error(err);
                }
            }));
}

setInterval(takeAndPostPic, 1000 * 60 * 15);
