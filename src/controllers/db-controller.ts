import { Database } from 'sqlite';

export default class DBController {
    constructor(private db: Database) {}

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
            sql += ' WHERE book_id = ? AND chapter_id = ?';
            params = [bookId, chapterId]
        }else if (bookId) {
            sql += ' WHERE book_id = ?';
            params = [bookId]
        } 

        const rows = await this.db.all(sql, params);
        return rows || []
    }
}