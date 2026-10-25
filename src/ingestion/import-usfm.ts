import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { CANONICAL_BOOKS } from '../catalog/osis.ts';
import { loadTranslationRegistry } from '../catalog/translation-registry.ts';
import { parseUsfm } from './usfm.ts';

export interface ImportResult {
    output: string;
    books: number;
    chapters: number;
    verses: number;
    sha256: string;
    sizeBytes: number;
}

export async function importUsfmDirectory(options: {
    sourceDirectory: string;
    translationId: string;
    output: string;
    registryPath?: string;
}): Promise<ImportResult> {
    const registry = await loadTranslationRegistry(options.registryPath);
    const translation = registry.translations.find((item) => item.id === options.translationId);
    if (!translation) throw new Error(`Unknown translation: ${options.translationId}`);
    if (translation.status === 'license-review' || translation.status === 'disabled') {
        throw new Error(`${translation.id} is not approved for ingestion`);
    }
    if (!translation.license.allowOfflineDistribution) {
        throw new Error(`${translation.id} does not permit offline distribution`);
    }

    const filenames = (await readdir(options.sourceDirectory))
        .filter((filename) => /\.usfm$/i.test(filename));
    const parsedBooks = [];
    for (const filename of filenames) {
        const parsed = parseUsfm(await readFile(resolve(options.sourceDirectory, filename), 'utf8'));
        const canonical = CANONICAL_BOOKS.get(parsed.osis);
        if (!canonical) throw new Error(`Unsupported or non-canonical book: ${parsed.osis}`);
        parsedBooks.push({ ...parsed, canonical });
    }
    parsedBooks.sort((left, right) => left.canonical.position - right.canonical.position);
    if (parsedBooks.length !== 66) throw new Error(`Expected 66 books, found ${parsedBooks.length}`);

    const output = resolve(options.output);
    const temporary = `${output}.tmp-${process.pid}`;
    await mkdir(dirname(output), { recursive: true });
    await rm(temporary, { force: true });
    const database = await open({ filename: temporary, driver: sqlite3.Database });

    try {
        await database.exec(`
            PRAGMA journal_mode=DELETE;
            PRAGMA foreign_keys=ON;
            CREATE TABLE translation (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, abbreviation TEXT NOT NULL,
                language TEXT NOT NULL, direction TEXT NOT NULL, revision TEXT NOT NULL
            );
            CREATE TABLE book (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, abbreviation TEXT NOT NULL,
                testament TEXT NOT NULL CHECK (testament IN ('OT', 'NT')),
                position INTEGER NOT NULL UNIQUE, chapter_count INTEGER NOT NULL
            );
            CREATE TABLE chapter (
                book_id TEXT NOT NULL REFERENCES book(id), number INTEGER NOT NULL,
                verse_count INTEGER NOT NULL, PRIMARY KEY (book_id, number)
            );
            CREATE TABLE verse (
                id INTEGER PRIMARY KEY, book_id TEXT NOT NULL REFERENCES book(id),
                chapter INTEGER NOT NULL, verse_label TEXT NOT NULL,
                verse_start INTEGER NOT NULL, verse_end INTEGER NOT NULL, text TEXT NOT NULL,
                UNIQUE (book_id, chapter, verse_label)
            );
            CREATE INDEX verse_reference_idx ON verse(book_id, chapter, verse_start);
            CREATE VIRTUAL TABLE verse_fts USING fts5(
                text, book_id UNINDEXED, chapter UNINDEXED, verse_label UNINDEXED,
                tokenize='unicode61 remove_diacritics 2'
            );
            CREATE TABLE license (
                translation_id TEXT PRIMARY KEY REFERENCES translation(id), spdx TEXT,
                credit TEXT NOT NULL, notice_url TEXT, official_url TEXT,
                allow_public_api INTEGER NOT NULL, allow_offline_distribution INTEGER NOT NULL,
                share_alike INTEGER NOT NULL
            );
            CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        `);
        await database.run(
            'INSERT INTO translation VALUES (?, ?, ?, ?, ?, ?)',
            translation.id, translation.name, translation.abbreviation, translation.language,
            translation.direction, translation.artifact?.revision ?? 'unknown',
        );
        await database.run(
            'INSERT INTO license VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            translation.id, translation.license.spdx ?? null, translation.license.credit,
            translation.license.noticeUrl ?? null, translation.license.officialUrl ?? null,
            Number(translation.license.allowPublicApi),
            Number(translation.license.allowOfflineDistribution), Number(translation.license.shareAlike),
        );

        await database.exec('BEGIN');
        let verseId = 1;
        for (const book of parsedBooks) {
            const chapters = new Map<number, typeof book.verses>();
            for (const verse of book.verses) {
                const chapterVerses = chapters.get(verse.chapter) ?? [];
                chapterVerses.push(verse);
                chapters.set(verse.chapter, chapterVerses);
            }
            await database.run(
                'INSERT INTO book VALUES (?, ?, ?, ?, ?, ?)',
                book.osis, book.name, book.abbreviation, book.canonical.testament,
                book.canonical.position, chapters.size,
            );
            for (const [chapter, verses] of chapters) {
                await database.run('INSERT INTO chapter VALUES (?, ?, ?)', book.osis, chapter, verses.length);
                for (const verse of verses) {
                    if (!verse.text) throw new Error(`Empty verse ${book.osis} ${chapter}:${verse.label}`);
                    await database.run(
                        'INSERT INTO verse VALUES (?, ?, ?, ?, ?, ?, ?)',
                        verseId, book.osis, chapter, verse.label, verse.start, verse.end, verse.text,
                    );
                    await database.run(
                        'INSERT INTO verse_fts(rowid, text, book_id, chapter, verse_label) VALUES (?, ?, ?, ?, ?)',
                        verseId, verse.text, book.osis, chapter, verse.label,
                    );
                    verseId += 1;
                }
            }
        }
        await database.run('INSERT INTO metadata VALUES (?, ?)', 'generated_at', new Date().toISOString());
        await database.run('INSERT INTO metadata VALUES (?, ?)', 'schema_version', '1');
        await database.exec('COMMIT');
        await database.exec('PRAGMA optimize; VACUUM;');
    } catch (error) {
        await database.exec('ROLLBACK').catch(() => undefined);
        throw error;
    } finally {
        await database.close();
    }

    await rm(output, { force: true });
    await rename(temporary, output);
    const content = await readFile(output);
    const details = await stat(output);
    const chapters = parsedBooks.reduce(
        (total, book) => total + new Set(book.verses.map((verse) => verse.chapter)).size, 0,
    );
    return {
        output,
        books: parsedBooks.length,
        chapters,
        verses: parsedBooks.reduce((total, book) => total + book.verses.length, 0),
        sha256: createHash('sha256').update(content).digest('hex'),
        sizeBytes: details.size,
    };
}
