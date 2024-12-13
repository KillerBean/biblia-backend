import IController from './controller-interface'
import DBClassSqlite from './db-class-sqlite';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

class SqliteController extends IController{
    dbController: DBClassSqlite | undefined;

    constructor(){
        super()
        this.init()
    }

    async init(){
        const db = await open({
            filename: './src/db/sqlite/ARC.sqlite', // Specify the database file
            mode: sqlite3.OPEN_READONLY, // Specify the mode of the database
            driver: sqlite3.Database,
          })
        
        this.dbController = new DBClassSqlite(db)
    }

    index(){
        return "Toda a Escritura é inspirada por Deus " +
         "e útil para o ensino, para a repreensão, para a correção, " +
         "para a educação na justiça, a fim de que o homem de Deus seja " +
         "perfeito e perfeitamente habilitado para toda boa obra.\n- 2 Timóteo 3:16-17"
    }

    getByID(id: Number) {
        return `${id}`
    }

    // TODO: create a method to get the list of versions from postgres
    async getVersionList(){
        // list files in the directory and return the list
        let dbFiles: string[] = []
        let dbFolder = join(__dirname, '../db/sqlite')

        try {
            const files = await readdir(dbFolder, { withFileTypes: false });
            for (const file of files)
              dbFiles.push(file.replace('.sqlite', ''));
          } catch (err) {
            console.error(err);
          }

        return dbFiles
    }

    async getBookByID(bookID:number){
        let book = await this.dbController?.getBookByID(bookID)
        return book || []
    }
    async getBooks() {
        const books = await this.dbController?.getBooks() || [];
        return books
    }
    async getBooksByTestament(testamentID:number){
        const books = await this.dbController?.getBooksByTestament(testamentID) || [];
        return books
    }
    async getVerses(bookID?:number, chapterID?:number){
        const verses = await this.dbController?.getVerses(bookID, chapterID)
        return verses
    }
}
export default new SqliteController()