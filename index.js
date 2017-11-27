require('dotenv').config();
const nw = require('node-webcam');
const { exec } = require('child_process');
const fs = require('fs');
const Twitter = require('twitter');
const { Subject } = require('rxjs');
const snapshotName = 'snapshot';
const snapshotPath = snapshotName + '.jpg';
const lastPhotoPath = 'last-snapshot.jpg';
const deleteLastPhoto = () => fs.unlink(lastPhotoPath, moveToLastPhoto);
const moveToLastPhoto = () => fs.rename(snapshotPath, lastPhotoPath, scheduleNexPhoto);
const scheduleNexPhoto = () => setTimeout(takePhoto, (~~(Math.random() * 20) + 5) * 60000);
const client = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const takePhoto = () => {
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
            convertPhoto();
        } else {
            console.error('Snapshot Error', err);
        }
    });
};

const convertPhoto = () => {
    exec(`magick convert ${snapshotName}.bmp ${snapshotPath}`, (err, out, serr) => {
        if (err) {
            console.error('could not convert to jpg', err);
        } else {
            diffPhotos();
        }
    });
};

const diffPhotos = () => {
    exec(`magick compare -metric RMSE ${snapshotPath} ${lastPhotoPath} diff.jpg`, (err, out, serr) => {
        let isDiff = true;
        try {
            const diff = +serr.match(/\(([\d.]+)\)/)[1];
            isDiff = diff > 0.08;
        } catch (ignore) { }
        diffResults(isDiff);
    });
};

const diffResults = isDiff => {
    if (isDiff) {
        postPhoto();
    } else {
        deleteLastPhoto();
    }
};

const postPhoto = () => {
    fs.readFile(snapshotPath, (err, media) => {
        if (err || !media) {
            console.error(err || 'no data...');
        } else {
            client.post('media/upload', { media }, (err, med, resp) => {
                if (!err) {
                    const status = {
                        status: '',
                        media_ids: med.media_id_string
                    };
                    client.post('statuses/update', status, (err, t, resp) => {
                        if (!err) {
                            //    console.log('Photo Tweeted!', t);
                        } else {
                            console.error('Tweet error', err);
                        }
                    });
                } else {
                    console.error('Twitter post error', err);
                }
                deleteLastPhoto();
            });
        }
    });
};

scheduleNexPhoto();
