import { CloudTasksClient } from '@google-cloud/tasks';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;

const cloudTasksClient = new CloudTasksClient();

export async function createHttpTask(destination: string, datetime: string, meetingUrl: string): Promise<void> {
    if (!GCP_PROJECT_ID) {
        throw new Error('Missing required environment variable: GCP_PROJECT_ID');
    }
    const location = 'asia-northeast1';
    const queue = 'line-notify-queue';
    const parent = cloudTasksClient.queuePath(GCP_PROJECT_ID, location, queue);

    const jsonData: TaskPayload = {
        destination,
        datetime,
        zoomUrl: meetingUrl
    };
    const payload = JSON.stringify(jsonData);

    const zuleDateTime = new Date(datetime).toISOString();
    const epocTime = Date.parse(zuleDateTime);

    const task = {
        name: `projects/${GCP_PROJECT_ID}/locations/${location}/queues/${queue}/tasks/${destination}-${datetime.replace(':', '-')}`,
        scheduleTime: {
            seconds: epocTime / 1000
        },
        httpRequest: {
            url: 'https://line-zoom-bot-kun-notifier-wk4o5s7qsq-an.a.run.app/message',
            httpMethod: 'POST' as const,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(payload).toString('base64')
        },
    };

    console.log(`Send create task request: ${JSON.stringify(task)}`);
    const request = { parent, task };
    const [response] = await cloudTasksClient.createTask(request);
    console.log(`Success create task: ${response.name}`);
}

export async function deleteTask(destination: string, datetime: string): Promise<void> {
    const location = 'asia-northeast1';
    const queue = 'line-notify-queue';

    const deleteRequest = {
        name: `projects/${GCP_PROJECT_ID}/locations/${location}/queues/${queue}/tasks/${destination}-${datetime.replace(':', '-')}`
    };

    await cloudTasksClient.deleteTask(deleteRequest);
    console.log('Success delete task');
}

interface TaskPayload {
    destination: string;
    datetime: string;
    zoomUrl: string;
}
