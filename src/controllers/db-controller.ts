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

    async getBooksByTestament(testamentId?: number): Promise<any[]> {
        const sql = 'SELECT * FROM book WHERE testament_reference_id = ?';

        if (testamentId) {
            const rows = await this.db.all(sql, [testamentId]);
            return rows || []
        }else {
            const rows = await this.db.all('SELECT * FROM book');
            return rows || []
        }
    }
}