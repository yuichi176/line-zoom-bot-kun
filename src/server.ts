import 'dotenv/config';
import express, { Request, Response } from 'express';
import { middleware } from '@line/bot-sdk';
import { handleEvent, config } from './handlers';
import { LineWebhookEvent } from './types';

interface LineWebhookRequest extends Request {
    body: {
        events: LineWebhookEvent[];
        destination: string;
    };
}

const app = express();

app.use('/linewebhook', middleware(config));

app.post('/linewebhook', (req: LineWebhookRequest, res: Response) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((error) => {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});

const port = process.env.PORT ?? '3000';

app.listen(port, () => {
    console.log(`express server listening on port ${port}`);
});