const axios = require("axios");

// ZOOM Secret
const ZoomAccountId = process.env.ZOOM_ACCOUNT_ID;
const ZoomClientId = process.env.ZOOM_CLIENT_ID;
const ZoomClientSecret = process.env.ZOOM_CLIENT_SECRET;

/**
 * Issue Zoom token using OAuth2 server-to-server flow
 * API Reference: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 */
async function issueZoomToken() {
    const baseNc = Buffer.from(ZoomClientId + ":" + ZoomClientSecret).toString('base64');
    try {
        const tokenResponse = await axios({
            method: 'post',
            url: "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=" + ZoomAccountId,
            headers: { 'Authorization': 'Basic ' + baseNc }
        });
        return tokenResponse.data.access_token;
    } catch (error) {
        console.error('Fail to issue Zoom Token:', error);
        throw error;
    }
}

/**
 * Create a Zoom meeting
 * API Reference: https://developers.zoom.us/docs/api/meetings/#tag/meetings/POST/meetings/{meetingId}/registrants
 */
async function createZoomMeeting(token, datetime) {
    try {
        const mtgResponse = await axios({
            method: 'post',
            url: 'https://api.zoom.us/v2/users/me/meetings',
            headers: { 'Authorization': 'Bearer ' + token },
            data: {
                'topic': 'people meeting',
                "type": "2", // A scheduled meeting
                "start_time": datetime,
                'timezone': 'Asia/Tokyo',
                'settings': {
                    "waiting_room": false,
                    "join_before_host": true,
                    "mute_upon_entry": true,
                }
            }
        });
        return mtgResponse.data.join_url;
    } catch (error) {
        console.error('Fail to create mtg url:', error);
        throw error;
    }
}

module.exports = {
    issueZoomToken,
    createZoomMeeting
};
