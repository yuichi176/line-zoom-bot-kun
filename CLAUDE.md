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
- **src/server.ts**: Express server with webhook endpoint (`/linewebhook`) 
- **src/handlers.ts**: LINE Bot event processing and business logic
- **src/zoom.ts**: Zoom API integration for meeting creation
- **src/firestore.ts**: Firestore database client configuration
- **src/tasks.ts**: Google Cloud Tasks integration for notifications
- **src/utils.ts**: Utility functions for date formatting and text parsing

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

## General Guidelines

### TypeScript Guidelines

# TypeScript Rules

These rules define best practices and required conventions for TypeScript development in this project. These rules are mandatory for all TypeScript code in this repository.

1. Nomenclature

- Use `PascalCase` for classes.
- Use `camelCase` for variables, functions, and methods.
- Use `UPPERCASE` for environment variables.
- Start each function with a verb.
- Use verbs for boolean variables. Example: `isLoading`, `hasError`, `canDelete`, etc.
- Use complete words instead of abbreviations and correct spelling.
- Except for standard abbreviations like API, URL, etc.

2. Type Annotations

- All exported functions, variables, and components must have explicit type annotations.
- Avoid using `any` unless absolutely necessary and justified with a comment.
- Use `unknown` instead of `any` when the type is not known at compile time.

3. Interfaces and Types

- Prefer `interface` over `type` for object shapes and public APIs.
- Use `type` for unions, intersections, and utility types.
- Extend interfaces for shared structures instead of duplicating properties.

4. Strictness

- The project must enable strict mode in `tsconfig.json`:
```json
{
    "compilerOptions": {
        "strict": true
    }
}
```
- No disabling of strict options unless discussed and documented.

5. Utility Types

- Use built-in utility types (`Partial`, `Pick`, `Omit`, `Record`, etc.) for type transformations.
- Prefer `Readonly` and `ReadonlyArray` for immutable data structures.

6. Enum Usage

- Avoid using `enum` unless interoperability with other systems or libraries requires it.
- Prefer union string literal types for simple cases:
```typescript
type ButtonVariant = 'primary' | 'secondary' | 'danger';
```

7. Type Inference

- Leverage TypeScript's type inference for local variables where the type is obvious.
- For function parameters and return types, always specify types explicitly.

8. Third-Party Types

- Always install and use type definitions for third-party libraries (`@types/*`).
- Do not use untyped libraries unless absolutely necessary and with team approval.

9. Error Handling

- Always handle possible `null` and `undefined` values explicitly.
- Use `Optional Chaining (?.)` and `Nullish Coalescing (??)` where appropriate.

10. Function Implementation

- If it returns a boolean, use `isX` or `hasX`, `canX`, etc.
- If it doesn't return anything, use `executeX` or `saveX`, etc.
- Use higher-order functions (map, `filter`, `reduce`, etc.) to avoid function nesting.
- Use arrow functions for simple functions (less than 3 instructions).
- Use named functions for non-simple functions.
- Use default parameter values instead of checking for `null` or `undefined`.
- Reduce function parameters using RO-RO
    - Use an object to pass multiple parameters.
    - Use an object to return results.
    - Declare necessary types for input arguments and output.

11. Class Implementation

- Follow SOLID principles.
- Prefer composition over inheritance.
- Declare interfaces to define contracts.
- Write small classes with a single purpose.
    - Less than 200 instructions.
    - Less than 10 public methods.
    - Less than 10 properties.