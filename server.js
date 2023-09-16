require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require("axios");

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();
app.post('/linewebhook', line.middleware(config), (req, res) => {
    console.log(JSON.stringify(req.body))
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result));
});

const client = new line.Client(config);

async function handleEvent(event) {
    console.log(`event: ${JSON.stringify(event)}`)
    if (event.type !== 'message' || event.message.type !== 'text' || event.message.text !== 'zoom') {
        return Promise.resolve(null);
    }

    const accountId =  process.env.ZOOM_ACCOUNT_ID
    const clientId = process.env.ZOOM_CLIENT_ID
    const clientSecret = process.env.ZOOM_CLIENT_SECRET

    const baseNc = Buffer.from(clientId + ":" + clientSecret).toString('base64');

    try {
        // ZOOMアクセストークン取得
        const tokenResponse = await axios({
            method: 'post',
            url: "https://zoom.us/oauth/token?grant_type=account_credentials&account_id="+ accountId,
            headers: { 'Authorization': 'Basic ' + baseNc }
        })
        const token = tokenResponse.data.access_token

        // ミーティングURL発行
        const now = getNow()
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
        const meetingUrl = mtgResponse.data.join_url

        // chatbot返信部分
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
}

app.listen(process.env.PORT);

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
