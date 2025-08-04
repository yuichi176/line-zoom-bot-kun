/**
 * Get current datetime in ISO format
 */
function getNow() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Format date from ISO to Japanese display format
 * 2017-12-25T01:00 → 2017/12/25 1:00
 */
function formatDate(inputDate) {
    const date = new Date(inputDate);

    const year = date.getFullYear();
    let month = date.getMonth() + 1; // 月は0から始まるため+1
    let day = date.getDate();
    const hours = date.getHours();
    let minutes = date.getMinutes();
    if (month.toString().length === 1) {
        month = `0` + month;
    }
    if (day.toString().length === 1) {
        day = `0` + day;
    }
    if (minutes.toString().length === 1) {
        minutes = `0` + minutes;
    }

    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * Parse postback data string into object
 */
function parseData(inputString) {
    const parts = inputString.split('&');
    const o = {};
    for (const part of parts) {
        const [key, value] = part.split('=');
        o[key] = value;
    }
    return o;
}

/**
 * Text matching functions for LINE bot commands
 */
function isZoom(text) {
    const regex = /^zoom$/i;
    return regex.test(text.trim());
}

function isReserve(text) {
    const regex = /^zoom予約$/i;
    return regex.test(text.trim());
}

function isReservedList(text) {
    const regex = /^zoom予約確認$/i;
    return regex.test(text.trim());
}

function isCancel(text) {
    const regex = /^zoomキャンセル$/i;
    return regex.test(text.trim());
}

module.exports = {
    getNow,
    formatDate,
    parseData,
    isZoom,
    isReserve,
    isReservedList,
    isCancel
};