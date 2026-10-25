import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import {
    loadTranslationRegistry,
    type TranslationDefinition,
} from '../catalog/translation-registry.ts';

export type TranslationAudience = 'public' | 'app';

export class TranslationService {
    private registry: Awaited<ReturnType<typeof loadTranslationRegistry>> | undefined;
    private readonly databases = new Map<string, Database>();

    constructor(private readonly dataDirectory = process.env.BIBLE_DATA_DIR ?? '/data/bibles') {}

    private async getRegistry() {
        this.registry ??= await loadTranslationRegistry();
        return this.registry;
    }

    async list(audience: TranslationAudience): Promise<TranslationDefinition[]> {
        const registry = await this.getRegistry();
        return registry.translations.filter((translation) => {
            if (!translation.license.allowPublicApi) return false;
            return audience === 'public'
                ? translation.status === 'published'
                : translation.status === 'published' || translation.status === 'download-approved';
        });
    }

    async definition(id: string, audience: TranslationAudience): Promise<TranslationDefinition | undefined> {
        return (await this.list(audience)).find((translation) => translation.id === id);
    }

    async ping(audience: TranslationAudience): Promise<void> {
        const translations = await this.list(audience);
        if (translations.length === 0) throw new Error(`No ${audience} translations are enabled`);
        for (const translation of translations) {
            const database = await this.database(translation.id, audience);
            await database.get('SELECT 1 AS healthy');
        }
    }

    private async database(id: string, audience: TranslationAudience): Promise<Database> {
        const definition = await this.definition(id, audience);
        if (!definition) throw Object.assign(new Error('Translation not found'), { status: 404 });
        const existing = this.databases.get(id);
        if (existing) return existing;
        const filename = resolve(this.dataDirectory, `${id}.sqlite`);
        try {
            await access(filename);
        } catch {
            throw Object.assign(new Error('Translation artifact is not provisioned'), { status: 503 });
        }
        const database = await open({ filename, mode: sqlite3.OPEN_READONLY, driver: sqlite3.Database });
        await database.exec('PRAGMA query_only=ON; PRAGMA cache_size=-32768; PRAGMA busy_timeout=3000;');
        this.databases.set(id, database);
        return database;
    }

    async books(id: string, audience: TranslationAudience) {
        const database = await this.database(id, audience);
        return database.all(
            'SELECT id, name, abbreviation, testament, position, chapter_count AS chapterCount FROM book ORDER BY position',
        );
    }

    async chapter(id: string, bookId: string, chapter: number, audience: TranslationAudience) {
        const database = await this.database(id, audience);
        const book = await database.get(
            'SELECT id, name, abbreviation, testament, position, chapter_count AS chapterCount FROM book WHERE id = ?',
            bookId.toUpperCase(),
        );
        if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
        const verses = await database.all(
            `SELECT verse_label AS number, verse_start AS verseStart, verse_end AS verseEnd, text
             FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse_start`,
            bookId.toUpperCase(), chapter,
        );
        if (verses.length === 0) throw Object.assign(new Error('Chapter not found'), { status: 404 });
        return { book, chapter, verses };
    }

    async search(id: string, query: string, limit: number, audience: TranslationAudience) {
        const database = await this.database(id, audience);
        const ftsQuery = query.match(/[\p{L}\p{N}]+/gu)?.map((token) => `"${token}"`).join(' ') ?? '';
        if (!ftsQuery) return [];
        return database.all(
            `SELECT f.book_id AS bookId, b.name AS bookName, f.chapter, f.verse_label AS number,
                    f.text, bm25(verse_fts) AS rank
             FROM verse_fts f JOIN book b ON b.id = f.book_id
             WHERE verse_fts MATCH ? ORDER BY rank LIMIT ?`,
            ftsQuery, limit,
        );
    }
}
