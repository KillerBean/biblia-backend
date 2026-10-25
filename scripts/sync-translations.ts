import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { S3ArtifactStore } from '../src/artifacts/s3-store.ts';
import { loadTranslationRegistry } from '../src/catalog/translation-registry.ts';

interface CurrentArtifact {
    revision: string;
    sqliteKey: string;
    manifestKey: string;
    sha256: string;
}

const bucket = process.env.BIBLE_S3_BUCKET;
if (!bucket) throw new Error('BIBLE_S3_BUCKET is required');
const dataDirectory = resolve(process.env.BIBLE_DATA_DIR ?? '/data/bibles');
await mkdir(dataDirectory, { recursive: true });
const store = new S3ArtifactStore({
    bucket,
    region: process.env.AWS_REGION,
    endpoint: process.env.BIBLE_S3_ENDPOINT,
    forcePathStyle: process.env.BIBLE_S3_FORCE_PATH_STYLE === 'true',
});

const registry = await loadTranslationRegistry();
for (const translation of registry.translations) {
    if (translation.status !== 'published' && translation.status !== 'download-approved') continue;
    if (!translation.license.allowPublicApi) continue;
    const current = await store.getJson<CurrentArtifact>(`translations/${translation.id}/current.json`);
    const output = resolve(dataDirectory, `${translation.id}.sqlite`);
    const temporary = `${output}.tmp-${process.pid}`;
    try {
        await store.getFile(current.sqliteKey, temporary);
        const checksum = createHash('sha256').update(await readFile(temporary)).digest('hex');
        if (checksum !== current.sha256) {
            throw new Error(`Checksum mismatch for ${translation.id}: expected ${current.sha256}, got ${checksum}`);
        }
        // POSIX rename replaces the old file atomically; existing readers keep their open inode.
        await rename(temporary, output);
        console.log(`Provisioned ${translation.id}@${current.revision} (${checksum})`);
    } finally {
        await rm(temporary, { force: true });
    }
}
