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

// Routing
app.post('/linewebhook', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result));
});

// Event Handler
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
                    "type": "template",
                    "altText": "this is a confirm template for zoom meeting reservation",
                    "template": {
                        "type": "confirm",
                        "text": `${datetime} で問題ないかな?`,
                        "actions": [
                            {
                                "type": "postback",
                                "label": "はい",
                                "data": `action=reserve-confirm-yes&datetime=${event.postback.data}`,
                            },
                            {
                                "type": "postback",
                                "label": "いいえ",
                                "data": "action=reserve-confirm-no",
                            }
                        ]
                    }
                })
            } catch (error) {
                console.error(error);
            }
        } else if (data.action === 'reserve-confirm-yes') {
            // TODO: impl
            try {
                return client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: "以下の日時でミーティングを予約したよ"
                });
            } catch (error) {
                console.error(error);
            }
        } else if (data.action === 'reserve-confirm-no') {
            try {
                return client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: "ミーティングの予約を中止したよ"
                    });
            } catch (error) {
                console.error(error);
            }
        } else {
            return Promise.resolve(null);
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

// 2017-12-25T01:00 → 2017年12月25日 1時00分
function formatDate(inputDate) {
    const date = new Date(inputDate);

    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 月は0から始まるため+1
    const day = date.getDate();
    const hours = date.getHours();
    let minutes = date.getMinutes();
    if (minutes.toString().length === 1) {
        minutes = `0` + minutes
    }

    return `${year}年${month}月${day}日 ${hours}時${minutes}分`;
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
    const regex = /zoom/i;
    return regex.test(text.trim());
}

function  isReserve(text) {
    const regex = /次回/;
    return regex.test(text.trim());
}
