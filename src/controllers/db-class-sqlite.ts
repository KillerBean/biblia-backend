import { Database } from 'sqlite';
import { Reference } from '../utils/bible-parser.ts';

export default class DBClassSqlite {
    private readonly db: Database;
    constructor(db: Database) {
        this.db = db;
    }

    async ping(): Promise<void> {
        await this.db.get('SELECT 1');
    }

    async getBookByID(bookId: number): Promise<any> {
        const sql = 'SELECT * FROM book WHERE id = ?';
        const row = await this.db.get(sql, [bookId]);
        return row || []
    }

    async getBooks(search?: string){
        let sql = 'SELECT * FROM book';
        let params: string[] = [];
        if (search) {
            sql += ' WHERE name LIKE ?';
            params.push(`%${search}%`);
        }
        const row = await this.db.all(sql, params);
        return row
    }

    async getChapterCount(bookId: number): Promise<number[]> {
        const sql = 'SELECT DISTINCT chapter FROM verse WHERE book_id = ? ORDER BY chapter ASC';
        const rows = await this.db.all(sql, [bookId]);
        return rows.map(r => r.chapter);
    }

    async getBooksByTestament(testamentId: number): Promise<any[]> {
        const sql = 'SELECT * FROM book WHERE testament_reference_id = ?';

        const rows = await this.db.all(sql, [testamentId]);
        return rows || []
        
    }

    async getVerses(bookId?: number, chapterId?: number, start?: number, end?: number): Promise<any[]> {
        if (chapterId && !bookId) {
            return []
        }

        let sql = `
            SELECT v.*, b.name as book_name, b.id as book_id 
            FROM verse v
            JOIN book b ON v.book_id = b.id
        `;
        let params: number[] = []
        let conditions: string[] = []

        if(bookId){
            conditions.push('v.book_id = ?');
            params.push(bookId);
        }
        
        if (chapterId) {
            conditions.push('v.chapter = ?');
            params.push(chapterId);
        }

        if (start) {
            conditions.push('v.verse >= ?');
            params.push(start);
        }

        if (end) {
            conditions.push('v.verse <= ?');
            params.push(end);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        const rows = await this.db.all(sql, params);
        return this.mapVersesWithBook(rows);
    }

    async getVersesByReference(ref: Reference): Promise<any[]> {
        let sql = `
            SELECT v.*, b.name as book_name, b.id as book_id 
            FROM verse v
            JOIN book b ON v.book_id = b.id
            WHERE v.book_id = ?
        `;
        const params: any[] = [ref.bookId];

        if (ref.endChapter) {
            sql += ' AND v.chapter >= ? AND v.chapter <= ?';
            params.push(ref.chapter, ref.endChapter);
        } else if (ref.chapter) {
            sql += ' AND v.chapter = ?';
            params.push(ref.chapter);

            if (ref.endVerse) {
                sql += ' AND v.verse >= ? AND v.verse <= ?';
                params.push(ref.verse, ref.endVerse);
            } else if (ref.verses && ref.verses.length > 0) {
                sql += ` AND v.verse IN (${ref.verses.map(() => '?').join(',')})`;
                params.push(...ref.verses);
            } else if (ref.verse) {
                sql += ' AND v.verse = ?';
                params.push(ref.verse);
            }
        }

        const rows = await this.db.all(sql, params);
        return this.mapVersesWithBook(rows);
    }

    async searchByText(text: string): Promise<any[]> {
        const words = text.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return [];

        let sql = `
            SELECT v.*, b.name as book_name, b.id as book_id 
            FROM verse v
            JOIN book b ON v.book_id = b.id
            WHERE
        `;
        const params: string[] = [];

        words.forEach((word, index) => {
            if (index > 0) sql += ' AND';
            sql += ' v.text LIKE ?';
            params.push(`%${word}%`);
        });

        sql += ' LIMIT 100';

        const rows = await this.db.all(sql, params);
        return this.mapVersesWithBook(rows);
    }

    private mapVersesWithBook(rows: any[]) {
        return rows.map(row => ({
            id: row.id,
            text: row.text,
            verse: row.verse,
            chapter: row.chapter,
            book: {
                id: row.book_id,
                name: row.book_name
            }
        }));
    }
}
