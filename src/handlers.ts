import { Client } from '@line/bot-sdk';
import db from './firestore';
import { createHttpTask, deleteTask } from './tasks';
import { issueZoomToken, createZoomMeeting } from './zoom';
import { getNow, formatDate, parseData, isZoom, isReserve, isReservedList, isCancel } from './utils';
import {
    LineConfig,
    LineWebhookEvent,
    TextMessage,
    TemplateMessage,
    QuickReplyMessage,
    MeetingData, LineMessageEvent
} from './types';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
    throw new Error('Missing required LINE environment variables: LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET');
}

export const config = {
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: LINE_CHANNEL_SECRET,
};

const client = new Client(config);

export async function handleEvent(event: LineWebhookEvent): Promise<any> {
    console.log(`event: ${JSON.stringify(event)}`);

    if (event.type === 'message') {
        return handleMessageEvent(event);
    } else if (event.type === 'postback') {
        return handlePostbackEvent(event);
    } else {
        return Promise.resolve(null);
    }
}

async function handleMessageEvent(event: LineWebhookEvent): Promise<any> {
    if (event.type !== 'message') {
        return Promise.resolve(null);
    }

    const messageType = event.message.type;
    const text = event.message.text;

    if (messageType !== 'text' || !text) {
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

async function handleInstantZoomRequest(event: LineWebhookEvent): Promise<any> {
    try {
        const token = await issueZoomToken();
        const meetingUrl = await createZoomMeeting(token, getNow());
        
        const messages: TextMessage[] = [
            {
                type: 'text',
                text: "わかったよ"
            },
            {
                type: 'text',
                text: meetingUrl
            },
        ];

        return client.replyMessage(event.replyToken, messages);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handleReserveRequest(event: LineWebhookEvent): Promise<any> {
    try {
        const destination = getDestination(event.source);
        const collectionRef = db.collection('destinations').doc(destination).collection('meetings');
        const snapshot = await collectionRef.get();
        let count = 0;
        let dateList = "";
        
        snapshot.forEach(doc => {
            const data = doc.data() as MeetingData;
            if (!data.isCancelled && !data.isNotified) {
                dateList += "\n・" + formatDate(doc.id);
                count += 1;
            }
        });
        
        if (count >= 3) {
            const messages: TextMessage[] = [
                {
                    type: 'text',
                    text: `予約数が上限に達しているよ。新しく予約するには以下のいずれかの予約をキャンセルする必要があるよ。${dateList}`
                },
                {
                    type: 'text',
                    text: "キャンセルするときは「zoomキャンセル」って話しかけてね。"
                }
            ];

            return client.replyMessage(event.replyToken, messages);
        }

        const currentDate = new Date();
        const oneMonthLater = new Date(currentDate);

        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        oneMonthLater.setDate(oneMonthLater.getDate() - 1);

        const max = oneMonthLater.toISOString().replace("T", "t").slice(0, 16);
        const min = currentDate.toISOString().replace("T", "t").slice(0, 16);
        
        const templateMessage: TemplateMessage = {
            type: "template",
            altText: "This is a datetime_picker for zoom meeting",
            template: {
                type: "buttons",
                title: "zoomミーティングの予約",
                text: "予約する日時を選んでね",
                actions: [
                    {
                        type: "datetimepicker",
                        label: "日時を選択",
                        data: "action=reserve-zoom-meeting",
                        mode: "datetime",
                        max: max,
                        min: min
                    }
                ]
            }
        };

        return client.replyMessage(event.replyToken, [templateMessage]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handleReservedListRequest(event: LineWebhookEvent): Promise<any> {
    try {
        const destination = getDestination(event.source);
        const collectionRef = db.collection('destinations').doc(destination).collection('meetings');
        const snapshot = await collectionRef.get();
        let dateList = "";
        
        snapshot.forEach(doc => {
            const data = doc.data() as MeetingData;
            if (!data.isCancelled && !data.isNotified) {
                dateList += "\n・" + formatDate(doc.id);
            }
        });
        
        const message: TextMessage = dateList === "" 
            ? { type: 'text', text: "予約されているzoomはないよ。" }
            : { type: 'text', text: `以下の日時で予約されているよ。${dateList}` };
        
        return client.replyMessage(event.replyToken, [message]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handleCancelRequest(event: LineWebhookEvent): Promise<any> {
    try {
        const currentDate = new Date();
        currentDate.setHours(currentDate.getHours());
        const oneMonthLater = new Date();
        currentDate.setHours(oneMonthLater.getHours());
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        oneMonthLater.setDate(oneMonthLater.getDate() - 1);
        const max = oneMonthLater.toISOString().replace("T", "t").slice(0, 16);
        const min = currentDate.toISOString().replace("T", "t").slice(0, 16);

        const templateMessage: TemplateMessage = {
            type: "template",
            altText: "This is a datetime_picker for zoom meeting",
            template: {
                type: "buttons",
                title: "zoomミーティングのキャンセル",
                text: "キャンセルする日時を選んでね",
                actions: [
                    {
                        type: "datetimepicker",
                        label: "日時を選択",
                        data: "action=cancel-zoom-meeting",
                        mode: "datetime",
                        max: max,
                        min: min
                    }
                ]
            }
        };

        return client.replyMessage(event.replyToken, [templateMessage]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handlePostbackEvent(event: LineWebhookEvent): Promise<any> {
    if (event.type !== 'postback') {
        return Promise.resolve(null);
    }

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

async function handleReserveDatetimeSelected(event: LineWebhookEvent): Promise<any> {
    if (event.type !== 'postback' || !event.postback.params?.datetime) {
        return Promise.resolve(null);
    }

    const datetime = formatDate(event.postback.params.datetime);
    
    try {
        const quickReplyMessage: QuickReplyMessage = {
            type: "text",
            text: `以下の日時で予約して問題ないかな？\n${datetime}`,
            quickReply: {
                items: [
                    {
                        type: "action",
                        action: {
                            type: "postback",
                            label: "はい",
                            displayText: "はい",
                            data: `action=reserve-confirm-yes&datetime=${event.postback.params.datetime}`,
                        }
                    },
                    {
                        type: "action",
                        action: {
                            type: "postback",
                            label: "いいえ",
                            displayText: "いいえ",
                            data: "action=reserve-confirm-no",
                        }
                    }
                ]
            }
        };

        return client.replyMessage(event.replyToken, [quickReplyMessage]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handleReserveConfirmYes(event: LineWebhookEvent): Promise<any> {
    const destination = getDestination(event.source);
    
    if (event.type !== 'postback') {
        return Promise.resolve(null);
    }

    const data = parseData(event.postback.data);
    const datetime = data.datetime;

    if (!datetime) {
        return Promise.resolve(null);
    }

    try {
        const token = await issueZoomToken();
        const meetingUrl = await createZoomMeeting(token, datetime);

        const docRef = db.collection('destinations').doc(destination).collection('meetings').doc(datetime);
        const meetingData: MeetingData = {
            startDatetime: datetime,
            zoomUrl: meetingUrl,
            isCancelled: false,
            isNotified: false,
        };
        
        await docRef.set(meetingData);
        console.log(`success save meeting: ${destination}:${datetime}`);

        await createHttpTask(destination, datetime, meetingUrl);

        const message: TextMessage = {
            type: 'text',
            text: `✅ミーティングの予約が完了したよ。\n時間が来たらお知らせするね。`
        };

        return client.replyMessage(event.replyToken, [message]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handleReserveConfirmNo(event: LineWebhookEvent): Promise<any> {
    try {
        const message: TextMessage = {
            type: 'text',
            text: "ミーティングの予約を中止したよ"
        };

        return client.replyMessage(event.replyToken, [message]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handleCancelDatetimeSelected(event: LineWebhookEvent): Promise<any> {
    if (event.type !== 'postback' || !event.postback.params?.datetime) {
        return Promise.resolve(null);
    }

    const destination = getDestination(event.source);
    const datetime = event.postback.params.datetime;
    const formattedDatetime = formatDate(datetime);
    
    try {
        const collectionRef = db.collection('destinations').doc(destination).collection('meetings');
        const snapshot = await collectionRef.get();
        let hasValidMeeting = false;
        
        snapshot.forEach(doc => {
            const data = doc.data() as MeetingData;
            if (!data.isCancelled && !data.isNotified && doc.id === datetime) {
                hasValidMeeting = true;
            }
        });
        
        if (!hasValidMeeting) {
            const message: TextMessage = {
                type: 'text',
                text: "その日時に予約されているミーティングはないよ。\n予約されているミーティングを確認するには「zoom予約確認」って話しかけてね。"
            };

            return client.replyMessage(event.replyToken, [message]);
        }

        const quickReplyMessage: QuickReplyMessage = {
            type: "text",
            text: `以下の日時をキャンセルして問題ないかな？\n${formattedDatetime}`,
            quickReply: {
                items: [
                    {
                        type: "action",
                        action: {
                            type: "postback",
                            label: "はい",
                            displayText: "はい",
                            data: `action=cancel-confirm-yes&datetime=${datetime}`,
                        }
                    },
                    {
                        type: "action",
                        action: {
                            type: "postback",
                            label: "いいえ",
                            displayText: "いいえ",
                            data: "action=cancel-confirm-no",
                        }
                    }
                ]
            }
        };

        return client.replyMessage(event.replyToken, [quickReplyMessage]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handleCancelConfirmYes(event: LineWebhookEvent): Promise<any> {
    const destination = getDestination(event.source);
    
    if (event.type !== 'postback') {
        return Promise.resolve(null);
    }

    const data = parseData(event.postback.data);
    const datetime = data.datetime;
    
    if (!datetime) {
        return Promise.resolve(null);
    }

    try {
        const docRef = db.collection('destinations').doc(destination).collection('meetings').doc(datetime);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return Promise.resolve(null);
        }

        const existingData = doc.data() as MeetingData;
        const updatedData: MeetingData = {
            startDatetime: existingData.startDatetime,
            zoomUrl: existingData.zoomUrl,
            isCancelled: true,
            isNotified: false,
        };
        
        await docRef.set(updatedData);
        console.log(`success update cancel status: ${destination}:${datetime}`);

        await deleteTask(destination, datetime);

        const message: TextMessage = {
            type: 'text',
            text: `✅ミーティングのキャンセルが完了したよ`
        };

        return client.replyMessage(event.replyToken, [message]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function handleCancelConfirmNo(event: LineWebhookEvent): Promise<any> {
    try {
        const message: TextMessage = {
            type: 'text',
            text: "ミーティングのキャンセルを中止したよ"
        };

        return client.replyMessage(event.replyToken, [message]);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

function getDestination(source: LineWebhookEvent['source']): string {
    return source.groupId || source.userId || source.roomId || 'unknown';
}