const { CloudTasksClient } = require('@google-cloud/tasks');

// GCP Secret
const GCPProjectId = process.env.GCP_PROJECT_ID;

// Create a Cloud Tasks client
const cloudTasksClient = new CloudTasksClient();

/**
 * Create Cloud Tasks task for meeting notification
 */
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
    const epocTime = Date.parse(zuleDateTime);

    // Object Reference: https://cloud.google.com/tasks/docs/reference/rest/v2/projects.locations.queues.tasks#Task
    const task = {
        name: `projects/${GCPProjectId}/locations/${location}/queues/${queue}/tasks/${destination}-${datetime.replace(":", "-")}`,
        scheduleTime: {
            seconds: epocTime / 1000
        },
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
    console.log(`Send create task request: ${JSON.stringify(task)}`);
    const request = { parent: parent, task: task };
    const [response] = await cloudTasksClient.createTask(request);
    console.log(`Success create task: ${response.name}`);
}

/**
 * Delete Cloud Tasks task
 */
async function deleteTask(destination, datetime) {
    const location = 'asia-northeast1';
    const queue = 'line-notify-queue';

    const response = await cloudTasksClient.deleteTask({
        name: `projects/${GCPProjectId}/locations/${location}/queues/${queue}/tasks/${destination}-${datetime.replace(":", "-")}`
    });
    console.log(`Success delete task`);
}

module.exports = {
    createHttpTask,
    deleteTask
};
