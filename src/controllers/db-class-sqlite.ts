import { Database } from 'sqlite';
import { Reference } from '../utils/bible-parser.ts';

export default class DBClassSqlite {
    private readonly db: Database;
    constructor(db: Database) {
        this.db = db;
    }

    async getBookByID(bookId: number): Promise<any> {
        const sql = 'SELECT * FROM book WHERE id = ?';
        const row = await this.db.get(sql, [bookId]);
        return row || []
    }

    async getBooks(){
        const sql = 'SELECT * FROM book';
        const row = await this.db.all(sql);
        return row
    }

    async getBooksByTestament(testamentId: number): Promise<any[]> {
        const sql = 'SELECT * FROM book WHERE testament_reference_id = ?';

        const rows = await this.db.all(sql, [testamentId]);
        return rows || []
        
    }

    async getVerses(bookId?: number, chapterId?: number): Promise<any[]> {
        let sql = 'SELECT * FROM verse';
        let params: number[] = []
        if (chapterId && !bookId) {
            return []
        }

        if(bookId && chapterId){
            sql += ' WHERE book_id = ? AND chapter = ?';
            params = [bookId, chapterId]
        }else if (bookId) {
            sql += ' WHERE book_id = ?';
            params = [bookId]
        } 

        const rows = await this.db.all(sql, params);
        return rows || []
    }

    async getVersesByReference(ref: Reference): Promise<any[]> {
        let sql = 'SELECT * FROM verse WHERE book_id = ?';
        const params: any[] = [ref.bookId];

        if (ref.endChapter) {
            // Chapter Range: 1-3
            // Assuming whole chapters. 
            // Note: If logic requires partial chapters (e.g. Rom 1:16 - 3:20), parser needs update.
            // Current parser only produces endChapter for "Book C1-C2".
            sql += ' AND chapter >= ? AND chapter <= ?';
            params.push(ref.chapter, ref.endChapter);
        } else if (ref.chapter) {
            sql += ' AND chapter = ?';
            params.push(ref.chapter);

            if (ref.endVerse) {
                sql += ' AND verse >= ? AND verse <= ?';
                params.push(ref.verse, ref.endVerse);
            } else if (ref.verses && ref.verses.length > 0) {
                sql += ` AND verse IN (${ref.verses.map(() => '?').join(',')})`;
                params.push(...ref.verses);
            } else if (ref.verse) {
                sql += ' AND verse = ?';
                params.push(ref.verse);
            }
        }

        return await this.db.all(sql, params);
    }

    async searchByText(text: string): Promise<any[]> {
        // Fuzzy search: Split words and ensure all are present (AND logic)
        // e.g. "Deus mundo" -> %Deus% AND %mundo%
        const words = text.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return [];

        let sql = 'SELECT * FROM verse WHERE';
        const params: string[] = [];

        words.forEach((word, index) => {
            if (index > 0) sql += ' AND';
            sql += ' text LIKE ?';
            params.push(`%${word}%`);
        });

        // Limit results to prevent overload on generic queries
        sql += ' LIMIT 100';

        return await this.db.all(sql, params);
    }
}