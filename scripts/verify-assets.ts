import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Asset = {
  file: string;
  sha256: string;
  sizeBytes: number;
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(projectRoot, 'docs/data-assets.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { assets: Asset[] };

for (const asset of manifest.assets) {
  const assetPath = resolve(projectRoot, asset.file);
  const [content, details] = await Promise.all([readFile(assetPath), stat(assetPath)]);
  const checksum = createHash('sha256').update(content).digest('hex');

  if (details.size !== asset.sizeBytes || checksum !== asset.sha256) {
    throw new Error(
      `Asset integrity check failed for ${asset.file}: ` +
      `expected ${asset.sha256}/${asset.sizeBytes}, got ${checksum}/${details.size}`,
    );
  }
}

console.log(`Verified ${manifest.assets.length} SQLite data assets.`);
