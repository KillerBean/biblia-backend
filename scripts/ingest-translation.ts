import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { S3ArtifactStore } from '../src/artifacts/s3-store.ts';
import { loadTranslationRegistry } from '../src/catalog/translation-registry.ts';
import { importUsfmDirectory } from '../src/ingestion/import-usfm.ts';

function run(command: string, args: string[]): Promise<string> {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += String(chunk); });
        child.stderr.on('data', (chunk) => { stderr += String(chunk); });
        child.on('error', reject);
        child.on('close', (code) => code === 0
            ? resolvePromise(stdout)
            : reject(new Error(`${command} exited ${code}: ${stderr}`)));
    });
}

async function findUsfmDirectory(root: string): Promise<string> {
    const pending = [root];
    while (pending.length > 0) {
        const current = pending.shift() as string;
        const entries = await readdir(current, { withFileTypes: true });
        if (entries.some((entry) => entry.isFile() && /\.usfm$/i.test(entry.name))) return current;
        pending.push(...entries.filter((entry) => entry.isDirectory()).map((entry) => join(current, entry.name)));
    }
    throw new Error('The official archive contains no USFM files');
}

const { values } = parseArgs({
    options: {
        translation: { type: 'string' },
        source: { type: 'string' },
        output: { type: 'string' },
        upload: { type: 'boolean', default: false },
    },
});
if (!values.translation) throw new Error('Missing --translation ID');

const registry = await loadTranslationRegistry();
const translation = registry.translations.find((item) => item.id === values.translation);
if (!translation) throw new Error(`Unknown translation: ${values.translation}`);
if (translation.status === 'license-review' || translation.status === 'disabled') {
    throw new Error(`${translation.id} has not been approved for ingestion`);
}
if (translation.source.kind !== 'official-download' && translation.source.kind !== 'holder-file') {
    throw new Error(`${translation.id} must come from an official download or holder-provided file`);
}
if (!translation.artifact) throw new Error(`${translation.id} has no artifact configuration`);

const workingDirectory = await mkdtemp(join(tmpdir(), `bible-${translation.id}-`));
try {
    const archive = join(workingDirectory, 'source.zip');
    if (values.source) {
        await writeFile(archive, await readFile(resolve(values.source)));
    } else {
        if (!translation.source.url) throw new Error(`${translation.id} has no official source URL`);
        const response = await fetch(translation.source.url, { redirect: 'follow' });
        if (!response.ok) throw new Error(`Official download failed with HTTP ${response.status}`);
        await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    }

    const archiveContent = await readFile(archive);
    if (archiveContent.byteLength > 100 * 1024 * 1024) throw new Error('Source archive exceeds 100 MiB');
    const sourceSha256 = createHash('sha256').update(archiveContent).digest('hex');
    if (translation.source.sha256 && sourceSha256 !== translation.source.sha256) {
        throw new Error(
            `Official source checksum changed: expected ${translation.source.sha256}, got ${sourceSha256}`,
        );
    }

    const entries = (await run('unzip', ['-Z1', archive])).split('\n').filter(Boolean);
    if (
        entries.length === 0 || entries.length > 5_000 ||
        entries.some((entry) => entry.startsWith('/') || entry.split('/').includes('..'))
    ) {
        throw new Error('Unsafe or empty ZIP archive');
    }
    const extracted = join(workingDirectory, 'extracted');
    await run('unzip', ['-q', archive, '-d', extracted]);
    const usfmDirectory = await findUsfmDirectory(extracted);
    const output = resolve(values.output ?? join(workingDirectory, `${translation.id}.sqlite`));
    const result = await importUsfmDirectory({
        sourceDirectory: usfmDirectory,
        translationId: translation.id,
        output,
    });
    const manifest = {
        schemaVersion: 1,
        translationId: translation.id,
        revision: translation.artifact.revision,
        generatedAt: new Date().toISOString(),
        source: { url: translation.source.url, sha256: sourceSha256, file: basename(archive) },
        sqlite: result,
        license: translation.license,
    };

    if (values.upload) {
        const bucket = process.env.BIBLE_S3_BUCKET;
        if (!bucket) throw new Error('BIBLE_S3_BUCKET is required with --upload');
        const store = new S3ArtifactStore({
            bucket,
            region: process.env.AWS_REGION,
            endpoint: process.env.BIBLE_S3_ENDPOINT,
            forcePathStyle: process.env.BIBLE_S3_FORCE_PATH_STYLE === 'true',
        });
        await store.putFile(translation.artifact.sourceKey, archive, 'application/zip');
        await store.putFile(translation.artifact.sqliteKey, output, 'application/vnd.sqlite3');
        const prefix = `translations/${translation.id}/${translation.artifact.revision}`;
        await store.putJson(`${prefix}/manifest.json`, manifest);
        await store.putJson(`translations/${translation.id}/current.json`, {
            revision: translation.artifact.revision,
            sqliteKey: translation.artifact.sqliteKey,
            manifestKey: `${prefix}/manifest.json`,
            sha256: result.sha256,
        });
    }
    console.log(JSON.stringify({ ...manifest, uploaded: values.upload, output }, null, 2));
} finally {
    if (!values.output) await rm(workingDirectory, { recursive: true, force: true });
}
