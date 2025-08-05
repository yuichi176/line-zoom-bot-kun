require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const { handleEvent, config } = require('./handlers');

const app = express();

app.use('/linewebhook', line.middleware(config));

app.post('/linewebhook', (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((error) => {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});

app.listen(process.env.PORT, () => {
    console.log(`express server listening on port ${process.env.PORT}`);
});
