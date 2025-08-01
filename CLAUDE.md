# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Start the development server
npm run start

# The server runs on the PORT environment variable (default: process.env.PORT)
```

## Architecture Overview

This is a modular Express.js LINE bot application organized under the `src/` directory that integrates multiple cloud services:

### Module Structure
- **src/server.js**: Express server with webhook endpoint (`/linewebhook`) 
- **src/handlers.js**: LINE Bot event processing and business logic
- **src/zoom.js**: Zoom API integration for meeting creation
- **src/firestore.js**: Firestore database client configuration
- **src/tasks.js**: Google Cloud Tasks integration for notifications
- **src/utils.js**: Utility functions for date formatting and text parsing

### Event-Driven Architecture
The bot operates on LINE's webhook model:
1. **Message Events**: Text parsing for commands (`zoom`, `zoom予約`, `zoom予約確認`, `zoomキャンセル`)
2. **Postback Events**: Handles datetime picker responses and confirmation dialogs
3. **State Management**: Uses Firestore collections structured as `destinations/{groupId|userId}/meetings/{datetime}`

### Key Business Logic
- **Reservation Limits**: Maximum 3 concurrent meetings per destination (group/user)
- **Scheduling Window**: Up to 1 month in advance (Cloud Tasks limitation)
- **Meeting Settings**: Pre-configured Zoom settings (no waiting room, join before host, mute on entry)
- **Notification System**: Automated reminders via Cloud Tasks + separate notification service

## Environment Configuration

Required environment variables (create `.env.local`):

```bash
# LINE Bot credentials
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
LINE_CHANNEL_SECRET=your_line_secret

# Zoom OAuth2 server-to-server app credentials  
ZOOM_ACCOUNT_ID=your_zoom_account_id
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret

# Google Cloud Platform setup
GOOGLE_APPLICATION_CREDENTIAL_PATH=path/to/service-account-key.json
GCP_PROJECT_ID=your_gcp_project_id

# Server configuration
PORT=8080
TZ=Asia/Tokyo
```

### Google Cloud Dependencies
- **Firestore**: Database for meeting storage
- **Cloud Tasks**: Queue: `line-notify-queue` in `asia-northeast1`
- **Cloud Run**: Notification service at `https://line-zoom-bot-kun-notifier-wk4o5s7qsq-an.a.run.app/message`

## Deployment Pipeline

### Local Development
```bash
# Run locally (requires all environment variables)
npm run start
```

### Production Deployment
- **Containerization**: Docker builds from Node.js 22 Alpine base image
- **Google Cloud Build**: Automated build and deployment via `cloudbuild.yaml`
- **Google Cloud Run**: Target service `line-zoom-bot-kun` in `asia-northeast1`

Build triggers on git commits:
```bash
# Manual build
gcloud builds submit --config cloudbuild.yaml
```

## Key Implementation Patterns

### Date/Time Handling
- Input format: `2017-12-25T01:00` (LINE datetime picker)
- Display format: `2017/12/25 1:00` (Japanese users)
- Storage: ISO string format in Firestore document IDs

### Error Handling
- All async operations wrapped in try-catch
- Errors logged to console and re-thrown for Express error handling
- User-friendly Japanese error messages via LINE reply

### Cloud Tasks Integration
- Task names include destination and datetime for idempotency
- Scheduled execution time matches meeting start time
- Payload includes meeting URL and destination for notification service

### TEXT PARSING
Text matching uses case-insensitive regex with exact matches:
- `isZoom()`: `/^zoom$/i`
- `isReserve()`: `/^zoom予約$/i` 
- `isReservedList()`: `/^zoom予約確認$/i`
- `isCancel()`: `/^zoomキャンセル$/i`