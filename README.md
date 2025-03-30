# line-zoom-bot-kun
LINE Official Account offering the following features related to Zoom meetings.

## Requirements

* Node.js >= 22

## Getting Started
1. Clone the repository

```shell
$ git clone git@github.com:yuichi176/line-zoom-bot-kun.git
```

2. Install dependencies

```shell
$ npm install
```

3. Set up environment variables

Create `.env.local` file in the root directory and set the following environment variables.

| Name                               | Description                                      |
|------------------------------------|--------------------------------------------------|
| LINE_CHANNEL_ACCESS_TOKEN          | Access token for the LINE channel                |
| LINE_CHANNEL_SECRET                | Secret key for the LINE channel                  |
| ZOOM_ACCOUNT_ID                    | Zoom account ID                                  |
| ZOOM_CLIENT_ID                     | Zoom client ID                                   |
| ZOOM_CLIENT_SECRET                 | Zoom client secret                               |
| GOOGLE_APPLICATION_CREDENTIAL_PATH | Path to Google application credentials JSON file |
| GCP_PROJECT_ID                     | Google Cloud Platform project ID                 |
| PORT                               | Port number for the server to listen on          |
| TZ                                 | Time zone setting                                |

4. Run the server
```shell
$ npm run start
```
