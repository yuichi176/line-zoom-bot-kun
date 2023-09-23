require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const Firestore = require('@google-cloud/firestore');
const { CloudTasksClient } = require('@google-cloud/tasks');
const axios = require("axios");

// LINE Secret
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};
// Create a LINE Messaging API client
const client = new line.Client(config);

// ZOOM Secret
const ZoomAccountId =  process.env.ZOOM_ACCOUNT_ID
const ZoomClientId = process.env.ZOOM_CLIENT_ID
const ZoomClientSecret = process.env.ZOOM_CLIENT_SECRET

// GCP Secret
const GoogleApplicationCredentialPath = process.env.GOOGLE_APPLICATION_CREDENTIAL_PATH
const GCPProjectId = process.env.GCP_PROJECT_ID
// Create a firestore client
const db = new Firestore({
    projectId: GCPProjectId,
    keyFilename: GoogleApplicationCredentialPath,
});
// Create a Cloud Tasks client
const cloudTasksClient = new CloudTasksClient();

const app = express();

// Middleware
app.use('/linewebhook', line.middleware(config))

// Routing
app.post('/linewebhook',(req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((error) => {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});

// Handler
async function handleEvent(event) {
    console.log(`event: ${JSON.stringify(event)}`)

    if (event.type === 'message') {
        const messageType = event.message.type
        const text = event.message.text
        if (messageType === 'text' && isZoom(text)) {
            try {
                // Issue Zoom token
                const token = await issueZoomToken()
                // Create a meeting url
                const meetingUrl = await createZoomMeeting(token, getNow())
                // Send Reply message
                return client.replyMessage(event.replyToken, [
                    {
                        type: 'text',
                        text: "わかったよ"
                    },
                    {
                        type: 'text',
                        text: meetingUrl
                    }
                ]);
            } catch (error) {
                console.error(error);
                throw error
            }
        } else if (messageType === 'text' && isReserve(text)) {
            try {
                // Send datetimepicker
                // API Reference: https://developers.line.biz/ja/reference/messaging-api/#buttons
                return client.replyMessage(event.replyToken, {
                    "type": "template",
                    "altText": "This is a datetime_picker for zoom meeting",
                    "template": {
                        "type": "buttons",
                        "title": "zoomミーティングの予約",
                        "text": "日時を選んでね",
                        "actions": [
                            {
                                "type": "datetimepicker",
                                "label": "日時を選択",
                                "data": "action=reserve-zoom-meeting",
                                "mode": "datetime",
                            }
                        ]
                    }
                });
            } catch (error) {
                console.error(error);
                throw error
            }
        } else {
            return Promise.resolve(null);
        }
    } else if (event.type === 'postback') {
        const data = parseData(event.postback.data)
        if (data.action === 'reserve-zoom-meeting') {
            const datetime = formatDate(event.postback.params.datetime)
            try {
                // Send Reply message
                // API Reference: https://developers.line.biz/ja/reference/messaging-api/#confirm
                return client.replyMessage(event.replyToken, {
                    "type": "text",
                    "text": `以下の日時で問題ないかな？\n${datetime}`,
                    "quickReply": {
                        "items": [
                            {
                                "type": "action",
                                "action": {
                                    "type": "postback",
                                    "label": "はい",
                                    "displayText": "はい",
                                    "data": `action=reserve-confirm-yes&datetime=${event.postback.params.datetime}`,
                                }
                            },
                            {
                                "type": "action",
                                "action": {
                                    "type": "postback",
                                    "label": "いいえ",
                                    "displayText": "いいえ",
                                    "data": "action=reserve-confirm-no",
                                }
                            }
                        ]
                    }
                })
            } catch (error) {
                console.error(error);
                throw error
            }
        } else if (data.action === 'reserve-confirm-yes') {
            const destination = event.source.groupId || event.source.userId || event.source.roomId
            const datetime = data.datetime

            try {
                // Issue Zoom token
                const token = await issueZoomToken()
                // Create a meeting url
                const meetingUrl = await createZoomMeeting(token, datetime)

                // Save meeting info to firestore
                const docRef = db.collection('destinations').doc(destination).collection('meetings').doc(datetime)
                await docRef.set({
                    startDatetime: datetime,
                    zoomUrl: meetingUrl,
                    isCancelled: false,
                    isNotified: false,
                })
                console.log(`success save meeting: ${destination}:${datetime}`)

                // Create Cloud Tasks task
                await createHttpTask(destination, datetime, meetingUrl)

                return client.replyMessage(event.replyToken, [
                    {
                        type: 'text',
                        text: `✅ミーティングの予約が完了したよ`
                    },
                    {
                        type: 'text',
                        text: `時間が来たらお知らせするね`
                    }
                ]);
            } catch (error) {
                console.error(error);
                throw error
            }
        } else if (data.action === 'reserve-confirm-no') {
            try {
                return client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: "ミーティングの予約を中止したよ"
                    });
            } catch (error) {
                console.error(error);
                throw error
            }
        } else {
            return Promise.resolve(null);
        }
    } else {
        return Promise.resolve(null);
    }
}

app.listen(process.env.PORT, () => {
    console.log(`express server listening on port ${process.env.PORT}`);
});

// Issue Zoom token
// API Reference: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
async function issueZoomToken() {
    const baseNc = Buffer.from(ZoomClientId + ":" + ZoomClientSecret).toString('base64');
    try {
        const tokenResponse = await axios({
            method: 'post',
            url: "https://zoom.us/oauth/token?grant_type=account_credentials&account_id="+ ZoomAccountId,
            headers: { 'Authorization': 'Basic ' + baseNc }
        })
        return tokenResponse.data.access_token
    } catch (error) {
        console.error('Fail to issue Zoom Token:', error);
        throw error;
    }
}

// Create a meeting url
// API Reference: https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate
async function createZoomMeeting(token, datetime) {
    try {
        const mtgResponse = await axios({
            method: 'post',
            url: 'https://api.zoom.us/v2/users/me/meetings',
            headers: { 'Authorization': 'Bearer ' + token },
            data: {
                'topic': 'people meeting',
                "type": "1", // 1:Daily, 2:Weekly, 3:Monthly
                "start_time": datetime,
                'timezone': 'Asia/Tokyo',
                'settings': {
                    "waiting_room": false,
                    "join_before_host": true,
                    "mute_upon_entry": true,
                    "use_pmi": false
                }
            }
        })
        return mtgResponse.data.join_url
    } catch (error) {
        console.error('Fail to create mtg url:', error);
        throw error;
    }
}

// Create Cloud Tasks task
async function createHttpTask(destination, datetime, meetingUrl) {
    const location = 'asia-northeast1';
    const queue = 'line-notify-queue';
    const parent = cloudTasksClient.queuePath(GCPProjectId, location, queue);

    const jsonData = {
        "destination": destination,
        "datetime": datetime,
        "zoomUrl": meetingUrl
    };
    const payload = JSON.stringify(jsonData);
    const zuleDateTime = new Date(datetime).toISOString();
    // const epocTime = Date.parse(zuleDateTime)

    // Object Reference: https://cloud.google.com/tasks/docs/reference/rest/v2/projects.locations.queues.tasks#Task
    const task = {
        name: `${destination}:${datetime}`,
        scheduleTime: zuleDateTime,
        // Object Reference: https://cloud.google.com/tasks/docs/reference/rest/v2/projects.locations.queues.tasks#HttpRequest
        httpRequest: {
            url: 'https://line-zoom-bot-kun-notifier-wk4o5s7qsq-an.a.run.app/message',
            httpMethod: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(payload).toString('base64')
        },
    };

    // Send create task request.
    console.log('Send create task request:');
    console.log(task);
    const request = {parent: parent, task: task};
    const [response] = await cloudTasksClient.createTask(request);
    console.log(`Success create task: ${response.name}`);
}

function getNow() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// 2017-12-25T01:00 → 2017/12/25 1:00
function formatDate(inputDate) {
    const date = new Date(inputDate);

    const year = date.getFullYear();
    let month = date.getMonth() + 1; // 月は0から始まるため+1
    let day = date.getDate();
    const hours = date.getHours();
    let minutes = date.getMinutes();
    if (month.toString().length === 1) {
        month = `0` + month
    }
    if (day.toString().length === 1) {
        day = `0` + day
    }
    if (minutes.toString().length === 1) {
        minutes = `0` + minutes
    }

    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function parseData(inputString) {
    const parts = inputString.split('&');
    const o = {};
    for (const part of parts) {
        const [key, value] = part.split('=');
        o[key] = value
    }
    return o
}

function isZoom(text) {
    const regex = /^zoom$/i;
    return regex.test(text.trim());
}

function  isReserve(text) {
    const regex = /^zoom予約$/i;
    return regex.test(text.trim());
}
