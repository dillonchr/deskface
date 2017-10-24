require('dotenv').config();
const nw = require('node-webcam');
const {exec} = require('child_process');
const fs = require('fs');
const snapshotName = 'test-snapshot';
const snapshotPath = snapshotName + '.jpg';
const lastPhotoPath = 'last-snapshot.jpg';
const Twitter = require('twitter');
const client = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

function takePicture() {
    return new Promise((resolve, reject) => 
        nw.capture(snapshotName, {
            delay: 0,
            width: 1280,
            height: 720,
            quality: 80,
            saveShots: false,
            output: 'bmp',
            callbackReturn: 'location'
        }, (err, data) => {
            if (!err && data) {
                resolve(data);
            } else {
                reject(err);
            }
        })
    )
    .then(convertSnapshot);
}

function convertSnapshot() {
    return new Promise((res, rej) => {
        exec(`magick convert ${snapshotName}.bmp ${snapshotPath}`, (err, out, serr) => {
            if (err) {
                console.error('could not convert to jpg', err);
            }
            res();
        });
    });
}

function diff() {
    return new Promise((res, rej) => exec(`magick compare -metric RMSE ${snapshotPath} ${lastPhotoPath} diff.jpg`, (err, out, serr) => {
        let isDiff = true;
        try {
            const diff = +serr.match(/\(([\d.]+)\)/)[1];
            //console.log('PicDiff', diff);
            isDiff = diff > 0.08;
        } catch (ignore) {}
        res(isDiff);
    }));
}

function deleteLastPhoto() {
    return new Promise((res, rej) => fs.unlink(lastPhotoPath, err => {
        res();
    }));
}

function moveSnapshotToLastPhoto() {
    return new Promise((res, rej) => fs.rename(snapshotPath, lastPhotoPath, err => {
        res();
    }));
}

function postPhoto() {
    return new Promise((res, rej) => {
        fs.readFile(snapshotPath, (err, media) => {
            if (err || !media) {
                console.error(err || 'no data...');
            } else {
                client.post('media/upload', {media}, (err, med, resp) => {
                    if (!err) {
                        const status = {
                            status: '',
                            media_ids: med.media_id_string
                        };
                        client.post('statuses/update', status, (err, t, resp) => {
                            if (!err) {
                                //    console.log('YES INDEEDY', t);
                            } else {
                                console.error('tweet error', err);
                            }
                        });
                    } else {
                        console.error('Twitter post error', err);
                    }
                    res();
                });
            }
        });
    });
}

function takeAndPostPic() {
    takePicture()
        .then(diff)
        .then(isDiff => {
            if (isDiff) {
                //console.log(`POSTING ${snapshotName}!`);
                return postPhoto();
            }
            //console.log(`NOT POSTING ${snapshotName}`);
        })
        .then(deleteLastPhoto)
        .then(moveSnapshotToLastPhoto);
}

function goRandomly() {
    setTimeout(takeAndPostPic, (~~(Math.random() * 20) + 5) * 60000);
}

goRandomly();
