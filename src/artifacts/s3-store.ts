import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface S3ArtifactOptions {
    bucket: string;
    region?: string;
    endpoint?: string;
    forcePathStyle?: boolean;
}

export class S3ArtifactStore {
    private readonly client: S3Client;

    constructor(private readonly options: S3ArtifactOptions) {
        this.client = new S3Client({
            region: options.region ?? 'us-east-1',
            endpoint: options.endpoint,
            forcePathStyle: options.forcePathStyle,
        });
    }

    async putFile(key: string, filename: string, contentType: string): Promise<void> {
        await this.client.send(new PutObjectCommand({
            Bucket: this.options.bucket,
            Key: key,
            Body: createReadStream(filename),
            ContentType: contentType,
            ServerSideEncryption: 'AES256',
            CacheControl: 'private, max-age=0, no-store',
        }));
    }

    async putJson(key: string, value: unknown): Promise<void> {
        await this.client.send(new PutObjectCommand({
            Bucket: this.options.bucket,
            Key: key,
            Body: JSON.stringify(value, null, 2),
            ContentType: 'application/json',
            ServerSideEncryption: 'AES256',
            CacheControl: 'private, max-age=0, no-store',
        }));
    }

    async putBuffer(key: string, filename: string, contentType: string): Promise<void> {
        await this.client.send(new PutObjectCommand({
            Bucket: this.options.bucket,
            Key: key,
            Body: await readFile(filename),
            ContentType: contentType,
            ServerSideEncryption: 'AES256',
            CacheControl: 'private, max-age=0, no-store',
        }));
    }

    async getJson<T>(key: string): Promise<T> {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.options.bucket,
            Key: key,
        }));
        if (!response.Body) throw new Error(`S3 object has no body: ${key}`);
        return JSON.parse(await response.Body.transformToString()) as T;
    }

    async getFile(key: string, filename: string): Promise<void> {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.options.bucket,
            Key: key,
        }));
        if (!response.Body) throw new Error(`S3 object has no body: ${key}`);
        await writeFile(filename, Buffer.from(await response.Body.transformToByteArray()));
    }
}
