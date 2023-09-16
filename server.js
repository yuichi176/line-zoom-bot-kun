require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require("axios");

// LINE Secret
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

// ZOOM Secret
const ZoomAccountId =  process.env.ZOOM_ACCOUNT_ID
const ZoomClientId = process.env.ZOOM_CLIENT_ID
const ZoomClientSecret = process.env.ZOOM_CLIENT_SECRET

const app = express();

// routing
app.post('/linewebhook', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result));
});

async function handleEvent(event) {
    console.log(`event: ${JSON.stringify(event)}`)

    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    const text = event.message.text.trim()
    if (isZoom(text)) {
        try {
            // Issue Zoom token
            const token = await issueZoomToken()
            // Create a meeting url
            const meetingUrl = await createZoomMeeting(token)
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
        }
    } else if (isSchedule(text)) {
        try {
            // Send datetimepicker
            return client.replyMessage(event.replyToken, {
                "type": "template",
                "altText": "This is a datetime_picker for zoom meeting",
                "template": {
                    "type": "buttons",
                    // "thumbnailImageUrl": "https://example.com/bot/images/image.jpg",
                    // "imageAspectRatio": "rectangle",
                    // "imageSize": "cover",
                    // "imageBackgroundColor": "#FFFFFF",
                    // "title": "",
                    "text": "zoomのミーティングを予約するよ",
                    "actions": [
                        {
                            "type": "datetimepicker",
                            "label": "日時を選んでね",
                            "data": "action=settime",
                            "mode": "datetime",
                            "initial": "2017-12-25t00:00",
                            "max": "2018-01-24t23:59",
                            "min": "2017-12-25t00:00"
                        }
                    ]
                }
            });
        } catch (error) {
            console.error(error);
        }
    } else {
        return Promise.resolve(null);
    }
}

app.listen(process.env.PORT);

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
async function createZoomMeeting(token) {
    const now = getNow()
    try {
        const mtgResponse = await axios({
            method: 'post',
            url: 'https://api.zoom.us/v2/users/me/meetings',
            headers: { 'Authorization': 'Bearer ' + token },
            data: {
                'topic': 'people meeting',
                "type": "1", // 1:Daily, 2:Weekly, 3:Monthly
                "start_time": now,
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

function getNow() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

function isZoom(text) {
    const regex = /zoom/i;
    return regex.test(text);
}

function  isSchedule(text) {
    const regex = /次回/;
    return regex.test(text);
}
