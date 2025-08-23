interface ParsedData {
    [key: string]: string;
}

export function getNow(): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function formatDate(inputDate: string): string {
    const date = new Date(inputDate);

    const year = date.getFullYear();
    let month: number | string = date.getMonth() + 1;
    let day: number | string = date.getDate();
    const hours = date.getHours();
    let minutes: number | string = date.getMinutes();
    
    if (month.toString().length === 1) {
        month = `0${month}`;
    }
    if (day.toString().length === 1) {
        day = `0${day}`;
    }
    if (minutes.toString().length === 1) {
        minutes = `0${minutes}`;
    }

    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export function parseData(inputString: string): ParsedData {
    const parts = inputString.split('&');
    const parsedObject: ParsedData = {};
    
    for (const part of parts) {
        const [key, value] = part.split('=');
        if (key && value) {
            parsedObject[key] = value;
        }
    }
    
    return parsedObject;
}

export function isZoom(text: string): boolean {
    const regex = /^zoom$/i;
    return regex.test(text.trim());
}

export function isReserve(text: string): boolean {
    const regex = /^zoom予約$/i;
    return regex.test(text.trim());
}

export function isReservedList(text: string): boolean {
    const regex = /^zoom予約確認$/i;
    return regex.test(text.trim());
}

export function isCancel(text: string): boolean {
    const regex = /^zoomキャンセル$/i;
    return regex.test(text.trim());
}