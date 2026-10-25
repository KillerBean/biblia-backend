import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type TranslationStatus = 'license-review' | 'download-approved' | 'published' | 'disabled';

export interface TranslationDefinition {
    id: string;
    abbreviation: string;
    name: string;
    language: string;
    direction: 'ltr' | 'rtl';
    status: TranslationStatus;
    source: {
        kind: 'official-download' | 'holder-file' | 'legacy-local';
        format: 'usfm' | 'usx' | 'sqlite';
        url?: string;
        sha256?: string;
        publisher: string;
    };
    license: {
        spdx?: string;
        credit: string;
        noticeUrl?: string;
        officialUrl?: string;
        allowPublicApi: boolean;
        allowOfflineDistribution: boolean;
        shareAlike: boolean;
    };
    artifact?: {
        revision: string;
        sqliteKey: string;
        sourceKey: string;
        sha256?: string;
    };
}

interface RegistryDocument {
    schemaVersion: number;
    translations: TranslationDefinition[];
}

const VALID_STATUSES = new Set<TranslationStatus>([
    'license-review', 'download-approved', 'published', 'disabled',
]);

export function validateRegistry(document: RegistryDocument): RegistryDocument {
    if (document.schemaVersion !== 1 || !Array.isArray(document.translations)) {
        throw new Error('Invalid translation registry schema');
    }

    const ids = new Set<string>();
    for (const translation of document.translations) {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(translation.id)) {
            throw new Error(`Invalid translation id: ${translation.id}`);
        }
        if (ids.has(translation.id)) throw new Error(`Duplicate translation id: ${translation.id}`);
        ids.add(translation.id);
        if (!VALID_STATUSES.has(translation.status)) {
            throw new Error(`Invalid status for ${translation.id}`);
        }
        if (translation.status === 'published' && !translation.license.allowPublicApi) {
            throw new Error(`${translation.id} cannot be published without public API permission`);
        }
        if (translation.source.kind === 'official-download' && !translation.source.url) {
            throw new Error(`${translation.id} has no official source URL`);
        }
        if (
            translation.status === 'published' &&
            (!translation.source.sha256 || !/^[a-f0-9]{64}$/.test(translation.source.sha256))
        ) {
            throw new Error(`${translation.id} has no pinned source checksum`);
        }
    }
    return document;
}

export async function loadTranslationRegistry(
    filename = resolve(process.cwd(), 'config/translations.json'),
): Promise<RegistryDocument> {
    const document = JSON.parse(await readFile(filename, 'utf8')) as RegistryDocument;
    return validateRegistry(document);
}

export function publicTranslations(document: RegistryDocument): TranslationDefinition[] {
    return document.translations.filter(
        (translation) => translation.status === 'published' && translation.license.allowPublicApi,
    );
}
