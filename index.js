require('dotenv').config();
const nw = require('node-webcam');
const {exec} = require('child_process');
const fs = require('fs');
const Twitter = require('twitter');
const { createStore } = require('redux');

const snapshotName = 'snapshot';
const snapshotPath = snapshotName + '.jpg';
const lastPhotoPath = 'last-snapshot.jpg';
const client = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const reducer = (state = {}, action) => {
    console.log(action);
    switch(action.type) {
        case 'TAKE-PHOTO':
            takePicture();
            break;
        case 'CONVERT-PHOTO':
            convertSnapshot();
            break;
        case 'DIFF-PHOTOS':
            diff();
            break;
        case 'DIFF':
            if (action.value) {
                postPhoto();
            } else {
                deleteLastPhoto();
            }
            break;
        case 'DELETE-LAST-PHOTO':
            deleteLastPhoto();
            break;
        case 'MOVE-PHOTO':
            moveSnapshotToLastPhoto();
            break;
        case 'SCHEDULE-NEXT-PHOTO':
            scheduleNextPhoto();
            break;
    }
    return state;
};

const store = createStore(reducer);

const actions = {
    takePhoto: () => store.dispatch({ type: 'TAKE-PHOTO' }),
    convertPhoto: () => store.dispatch({ type: 'CONVERT-PHOTO' }),
    diffPhotos: () => store.dispatch({ type: 'DIFF-PHOTOS' }),
    diffResults: (isDiff) => store.dispatch( {type: 'DIFF', value: isDiff }),
    deleteLastPhoto: () => store.dispatch({ type: 'DELETE-LAST-PHOTO' }),
    moveToLastPhoto: () => store.dispatch({ type: 'MOVE-PHOTO' }),
    scheduleNexPhoto: () => store.dispatch({ type: 'SCHEDULE-NEXT-PHOTO' })
};

function takePicture() {
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
            actions.convertPhoto();
        } else {
            console.error('Snapshot Error', err);
        }
    });
}

function convertSnapshot() {
    exec(`magick convert ${snapshotName}.bmp ${snapshotPath}`, (err, out, serr) => {
        if (err) {
            console.error('could not convert to jpg', err);
        } else {
            actions.diffPhotos();
        }
    });
}

function diff() {
    exec(`magick compare -metric RMSE ${snapshotPath} ${lastPhotoPath} diff.jpg`, (err, out, serr) => {
        let isDiff = true;
        try {
            const diff = +serr.match(/\(([\d.]+)\)/)[1];
            isDiff = diff > 0.08;
        } catch (ignore) { }
        actions.diffResults(isDiff);
    });
}

const deleteLastPhoto = () => fs.unlink(lastPhotoPath, actions.moveToLastPhoto);
const moveSnapshotToLastPhoto = () => fs.rename(snapshotPath, lastPhotoPath, actions.scheduleNexPhoto);
const scheduleNextPhoto = () => setTimeout(actions.takePhoto, (~~(Math.random() * 20) + 5) * 60000);

function postPhoto() {
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
                actions.deleteLastPhoto();
            });
        }
    });
}

actions.takePhoto();
