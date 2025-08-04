const line = require('@line/bot-sdk');
const db = require('./firestore');
const { createHttpTask, deleteTask } = require('./tasks');
const { issueZoomToken, createZoomMeeting } = require('./zoom');
const { getNow, formatDate, parseData, isZoom, isReserve, isReservedList, isCancel } = require('./utils');

// LINE Secret
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// Create a LINE Messaging API client
const client = new line.Client(config);

/**
 * Main event handler for LINE webhook events
 */
async function handleEvent(event) {
    console.log(`event: ${JSON.stringify(event)}`);

    if (event.type === 'message') {
        return handleMessageEvent(event);
    } else if (event.type === 'postback') {
        return handlePostbackEvent(event);
    } else {
        return Promise.resolve(null);
    }
}

/**
 * Handle LINE message events
 */
async function handleMessageEvent(event) {
    const messageType = event.message.type;
    const text = event.message.text;

    if (messageType !== 'text') {
        return Promise.resolve(null);
    }

    if (isZoom(text)) {
        return handleInstantZoomRequest(event);
    } else if (isReserve(text)) {
        return handleReserveRequest(event);
    } else if (isReservedList(text)) {
        return handleReservedListRequest(event);
    } else if (isCancel(text)) {
        return handleCancelRequest(event);
    } else {
        return Promise.resolve(null);
    }
}

/**
 * Handle instant Zoom meeting creation
 */
async function handleInstantZoomRequest(event) {
    try {
        // Issue Zoom token
        const token = await issueZoomToken();
        // Create a meeting url
        const meetingUrl = await createZoomMeeting(token, getNow());
        // Send Reply message
        return client.replyMessage(event.replyToken, [
            {
                type: 'text',
                text: "わかったよ"
            },
            {
                type: 'text',
                text: meetingUrl
            },
        ]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle meeting reservation request
 */
async function handleReserveRequest(event) {
    try {
        // ミーティングの予約上限のチェック（最大3件まで）
        const destination = event.source.groupId || event.source.userId || event.source.roomId;
        const collectionRef = db.collection('destinations').doc(destination).collection('meetings');
        const snapshot = await collectionRef.get();
        let count = 0;
        let dateList = "";
        
        snapshot.forEach(doc => {
            if (doc.data().isCancelled === false && doc.data().isNotified === false) {
                dateList += "\n・" + formatDate(doc.id);
                count += 1;
            }
        });
        
        if (count >= 3) {
            return client.replyMessage(event.replyToken, [
                {
                    type: 'text',
                    text: `予約数が上限に達しているよ。新しく予約するには以下のいずれかの予約をキャンセルする必要があるよ。${dateList}`
                },
                {
                    type: 'text',
                    text: "キャンセルするときは「zoomキャンセル」って話しかけてね。"
                }
            ]);
        }

        const currentDate = new Date();
        currentDate.setHours(currentDate.getHours());
        const oneMonthLater = new Date();
        currentDate.setHours(oneMonthLater.getHours());
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        oneMonthLater.setDate(oneMonthLater.getDate() - 1);
        const max = oneMonthLater.toISOString().replace("T", "t").slice(0, 16);
        const min = currentDate.toISOString().replace("T", "t").slice(0, 16);
        
        // Send datetimepicker
        // API Reference: https://developers.line.biz/ja/reference/messaging-api/#buttons
        return client.replyMessage(event.replyToken, {
            "type": "template",
            "altText": "This is a datetime_picker for zoom meeting",
            "template": {
                "type": "buttons",
                "title": "zoomミーティングの予約",
                "text": "予約する日時を選んでね",
                // Object Reference: https://developers.line.biz/ja/reference/messaging-api/#action-objects
                "actions": [
                    {
                        "type": "datetimepicker",
                        "label": "日時を選択",
                        "data": "action=reserve-zoom-meeting",
                        "mode": "datetime",
                        "max": max, // Cloud Tasksの制約で1ヶ月先の予約までしかできない
                        "min": min
                    }
                ]
            }
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle reserved meetings list request
 */
async function handleReservedListRequest(event) {
    try {
        const destination = event.source.groupId || event.source.userId || event.source.roomId;
        const collectionRef = db.collection('destinations').doc(destination).collection('meetings');
        const snapshot = await collectionRef.get();
        let dateList = "";
        
        snapshot.forEach(doc => {
            if (doc.data().isCancelled === false && doc.data().isNotified === false) {
                dateList += "\n・" + formatDate(doc.id);
            }
        });
        
        if (dateList === "") {
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: "予約されているzoomはないよ。"
            });
        }
        
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `以下の日時で予約されているよ。${dateList}`
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle meeting cancellation request
 */
async function handleCancelRequest(event) {
    try {
        const currentDate = new Date();
        currentDate.setHours(currentDate.getHours());
        const oneMonthLater = new Date();
        currentDate.setHours(oneMonthLater.getHours());
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        oneMonthLater.setDate(oneMonthLater.getDate() - 1);
        const max = oneMonthLater.toISOString().replace("T", "t").slice(0, 16);
        const min = currentDate.toISOString().replace("T", "t").slice(0, 16);

        // Send datetimepicker
        // API Reference: https://developers.line.biz/ja/reference/messaging-api/#buttons
        return client.replyMessage(event.replyToken, {
            "type": "template",
            "altText": "This is a datetime_picker for zoom meeting",
            "template": {
                "type": "buttons",
                "title": "zoomミーティングのキャンセル",
                "text": "キャンセルする日時を選んでね",
                // Object Reference: https://developers.line.biz/ja/reference/messaging-api/#action-objects
                "actions": [
                    {
                        "type": "datetimepicker",
                        "label": "日時を選択",
                        "data": "action=cancel-zoom-meeting",
                        "mode": "datetime",
                        "max": max,
                        "min": min
                    }
                ]
            }
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle LINE postback events
 */
async function handlePostbackEvent(event) {
    const data = parseData(event.postback.data);
    
    if (data.action === 'reserve-zoom-meeting') {
        return handleReserveDatetimeSelected(event);
    } else if (data.action === 'reserve-confirm-yes') {
        return handleReserveConfirmYes(event);
    } else if (data.action === 'reserve-confirm-no') {
        return handleReserveConfirmNo(event);
    } else if (data.action === 'cancel-zoom-meeting') {
        return handleCancelDatetimeSelected(event);
    } else if (data.action === 'cancel-confirm-yes') {
        return handleCancelConfirmYes(event);
    } else if (data.action === 'cancel-confirm-no') {
        return handleCancelConfirmNo(event);
    } else {
        return Promise.resolve(null);
    }
}

/**
 * Handle datetime selection for reservation
 */
async function handleReserveDatetimeSelected(event) {
    const datetime = formatDate(event.postback.params.datetime);
    try {
        // Send Reply message
        // API Reference: https://developers.line.biz/ja/reference/messaging-api/#confirm
        return client.replyMessage(event.replyToken, {
            "type": "text",
            "text": `以下の日時で予約して問題ないかな？\n${datetime}`,
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
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle reservation confirmation (Yes)
 */
async function handleReserveConfirmYes(event) {
    const destination = event.source.groupId || event.source.userId || event.source.roomId;
    const data = parseData(event.postback.data);
    const datetime = data.datetime;

    try {
        // Issue Zoom token
        const token = await issueZoomToken();
        // Create a meeting url
        const meetingUrl = await createZoomMeeting(token, datetime);

        // Save meeting info to firestore
        const docRef = db.collection('destinations').doc(destination).collection('meetings').doc(datetime);
        await docRef.set({
            startDatetime: datetime,
            zoomUrl: meetingUrl,
            isCancelled: false,
            isNotified: false,
        });
        console.log(`success save meeting: ${destination}:${datetime}`);

        // Create Cloud Tasks task
        await createHttpTask(destination, datetime, meetingUrl);

        return client.replyMessage(event.replyToken, [
            {
                type: 'text',
                text: `✅ミーティングの予約が完了したよ。\n時間が来たらお知らせするね。`
            }
        ]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle reservation confirmation (No)
 */
async function handleReserveConfirmNo(event) {
    try {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: "ミーティングの予約を中止したよ"
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle datetime selection for cancellation
 */
async function handleCancelDatetimeSelected(event) {
    const destination = event.source.groupId || event.source.userId || event.source.roomId;
    const datetime = event.postback.params.datetime;
    const formattedDatetime = formatDate(event.postback.params.datetime);
    
    try {
        // キャンセル対象のミーティングがあるか確認
        const collectionRef = db.collection('destinations').doc(destination).collection('meetings');
        const snapshot = await collectionRef.get();
        let flg = false;
        
        snapshot.forEach(doc => {
            if (doc.data().isCancelled === false && doc.data().isNotified === false) {
                if (doc.id === datetime) {
                    flg = true;
                }
            }
        });
        
        if (flg === false) {
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: "その日時に予約されているミーティングはないよ。\n予約されているミーティングを確認するには「zoom予約確認」って話しかけてね。"
            });
        }

        // Send Reply message
        // API Reference: https://developers.line.biz/ja/reference/messaging-api/#confirm
        return client.replyMessage(event.replyToken, {
            "type": "text",
            "text": `以下の日時をキャンセルして問題ないかな？\n${formattedDatetime}`,
            "quickReply": {
                "items": [
                    {
                        "type": "action",
                        "action": {
                            "type": "postback",
                            "label": "はい",
                            "displayText": "はい",
                            "data": `action=cancel-confirm-yes&datetime=${datetime}`,
                        }
                    },
                    {
                        "type": "action",
                        "action": {
                            "type": "postback",
                            "label": "いいえ",
                            "displayText": "いいえ",
                            "data": "action=cancel-confirm-no",
                        }
                    }
                ]
            }
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle cancellation confirmation (Yes)
 */
async function handleCancelConfirmYes(event) {
    const destination = event.source.groupId || event.source.userId || event.source.roomId;
    const data = parseData(event.postback.data);
    const datetime = data.datetime;
    
    try {
        // Update cancel status
        const docRef = db.collection('destinations').doc(destination).collection('meetings').doc(datetime);
        const doc = await docRef.get();
        await docRef.set({
            startDatetime: doc.data().startDatetime,
            zoomUrl: doc.data().zoomUrl,
            isCancelled: true,
            isNotified: false,
        });
        console.log(`success update cancel status: ${destination}:${datetime}`);

        // Delete Cloud Tasks task
        await deleteTask(destination, datetime);

        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `✅ミーティングのキャンセルが完了したよ`
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Handle cancellation confirmation (No)
 */
async function handleCancelConfirmNo(event) {
    try {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: "ミーティングのキャンセルを中止したよ"
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

module.exports = {
    handleEvent,
    config
};
