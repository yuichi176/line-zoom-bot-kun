export interface MeetingData {
    startDatetime: string;
    zoomUrl: string;
    isCancelled: boolean;
    isNotified: boolean;
}

export interface PostbackParams {
    datetime?: string;
}

export interface LineSource {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
}

export interface LineMessage {
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
    text?: string;
}

export interface LineMessageEvent {
    type: 'message';
    replyToken: string;
    source: LineSource;
    timestamp: number;
    message: LineMessage;
}

export interface LinePostbackEvent {
    type: 'postback';
    replyToken: string;
    source: LineSource;
    timestamp: number;
    postback: {
        data: string;
        params?: PostbackParams;
    };
}

export type LineWebhookEvent = LineMessageEvent | LinePostbackEvent;

export interface TextMessage {
    type: 'text';
    text: string;
}

export interface TemplateMessage {
    type: 'template';
    altText: string;
    template: ButtonsTemplate;
}

export interface ButtonsTemplate {
    type: 'buttons';
    title: string;
    text: string;
    actions: DatetimePickerAction[];
}

export interface DatetimePickerAction {
    type: 'datetimepicker';
    label: string;
    data: string;
    mode: 'datetime';
    max: string;
    min: string;
}

export interface QuickReplyMessage extends TextMessage {
    quickReply: {
        items: QuickReplyItem[];
    };
}

export interface QuickReplyItem {
    type: 'action';
    action: PostbackAction;
}

export interface PostbackAction {
    type: 'postback';
    label: string;
    displayText: string;
    data: string;
}
