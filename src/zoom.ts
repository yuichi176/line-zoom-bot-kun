import axios, { AxiosResponse } from 'axios';

const zoomAccountId: string | undefined = process.env.ZOOM_ACCOUNT_ID;
const zoomClientId: string | undefined = process.env.ZOOM_CLIENT_ID;
const zoomClientSecret: string | undefined = process.env.ZOOM_CLIENT_SECRET;

if (!zoomAccountId || !zoomClientId || !zoomClientSecret) {
    throw new Error('Missing required Zoom environment variables: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, or ZOOM_CLIENT_SECRET');
}

export async function issueZoomToken(): Promise<string> {
    const baseNc = Buffer.from(`${zoomClientId}:${zoomClientSecret}`).toString('base64');
    
    try {
        const tokenResponse: AxiosResponse<ZoomTokenResponse> = await axios({
            method: 'post',
            url: `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${zoomAccountId}`,
            headers: { 'Authorization': `Basic ${baseNc}` }
        });
        
        return tokenResponse.data.access_token;
    } catch (error) {
        console.error('Fail to issue Zoom Token:', error);
        throw error;
    }
}

export async function createZoomMeeting(token: string, datetime: string): Promise<string> {
    const meetingData = {
        topic: 'people meeting',
        type: '2',
        start_time: datetime,
        timezone: 'Asia/Tokyo',
        settings: {
            waiting_room: false,
            join_before_host: true,
            mute_upon_entry: true,
        }
    } satisfies ZoomMeetingRequest;

    try {
        const mtgResponse: AxiosResponse<ZoomMeetingResponse> = await axios({
            method: 'post',
            url: 'https://api.zoom.us/v2/users/me/meetings',
            headers: { 'Authorization': `Bearer ${token}` },
            data: meetingData
        });
        
        return mtgResponse.data.join_url;
    } catch (error) {
        console.error('Fail to create mtg url:', error);
        throw error;
    }
}

interface ZoomTokenResponse {
    access_token: string;
}

interface ZoomMeetingResponse {
    join_url: string;
}

interface ZoomMeetingSettings {
    waiting_room: boolean;
    join_before_host: boolean;
    mute_upon_entry: boolean;
}

interface ZoomMeetingRequest {
    topic: string;
    type: string;
    start_time: string;
    timezone: string;
    settings: ZoomMeetingSettings;
}
