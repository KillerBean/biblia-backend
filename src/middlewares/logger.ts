import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const startMs = Date.now();

    res.locals.requestId = requestId;

    res.on('finish', () => {
        const log = {
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Date.now() - startMs,
            ip: req.ip,
        };
        console.log(JSON.stringify(log));
    });

    next();
};
