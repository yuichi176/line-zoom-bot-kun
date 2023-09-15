const express = require('express');
const line = require('@line/bot-sdk');
const axios = require("axios");

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();
app.post('/linewebhook', line.middleware(config), (req, res) => {
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

    // zoomURL発行
    const accountId =  process.env.ZOOM_ACCOUNT_ID
    const clientId = process.env.ZOOM_CLIENT_ID
    const clientSecret = process.env.ZOOM_CLIENT_SECRET

    const baseNc = Buffer.from(clientId + ":" + clientSecret).toString('base64');

    try {
        // アクセストークン取得
        const tokenResponse = await axios({
            method: 'post',
            url: "https://zoom.us/oauth/token?grant_type=account_credentials&account_id="+ accountId,
            headers: { 'Authorization': 'Basic ' + baseNc }
        })
        console.log(`token: ${tokenResponse.data.access_token}`)
        const token = tokenResponse.data.access_token

        // ミーティングURL取得
        const mtgResponse = await axios({
            method: 'post',
            url: 'https://api.zoom.us/v2/users/me/meetings',
            headers: { 'Authorization': 'Bearer ' + token },
            data: {
                'topic': 'people meeting',
                'type': '1',
                'timezone': 'Asia/Tokyo',
                'settings': { 'use_pmi': 'false' }
            }
        })
        console.log(`url: ${mtgResponse.data.join_url}`)
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
