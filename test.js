const nw = require('node-webcam');
const {exec} = require('child_process');
const fs = require('fs');
const snapshotName = 'test-snapshot';
const lastPhotoName = 'last-snapshot.jpg';

function takePicture() {
    return new Promise((resolve, reject) => 
        nw.capture(snapshotName, {
            delay: 0,
            width: 1280,
            height: 720,
            quality: 80,
            saveShots: false,
            output: 'jpeg',
            callbackReturn: 'location'
        }, (err, data) => {
            if (!err && data) {
                resolve(data);
            } else {
                reject(err);
            }
        })
    );
}

function diff() {
    return new Promise((res, rej) => exec(`magick compare -metric RMSE ${snapshotName}.jpg ${lastPhotoName} diff.jpg`, (err, out, serr) => {
        let isDiff = true;
        try {
            console.log(serr);
            const diff = +serr.match(/\(([\d.]+)\)/)[1];
            console.log('PicDiff', diff);
            isDiff = diff > 0.08;
        } catch (ignore) {}
        res(isDiff);
    }));
}

function deleteLastPhoto() {
    return new Promise((res, rej) => fs.unlink(lastPhotoName, err => {
        res();
    }));
}

function moveSnapshotToLastPhoto() {
    return new Promise((res, rej) => fs.rename(snapshotName + '.jpg', lastPhotoName, err => {
        res();
    }));
}

takePicture()
    .then(diff)
    .then(isDiff => {
        if (isDiff) {
            console.log(`POSTING ${snapshotName}!`);
        } else {
            console.log(`NOT POSTING ${snapshotName}`);
        }
    })
    .then(deleteLastPhoto)
    .then(moveSnapshotToLastPhoto);
