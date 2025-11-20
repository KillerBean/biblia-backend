export interface IController{
    index():any;
    getVersionList():Promise<string[]>;
    getBookByID(bookID:number):Promise<any>;
    getBooksByTestament(testamentID:number):Promise<any>;
    getVerses(bookID?:number, chapterID?:number):Promise<any[]>;
    getBooks(testamentId?:number):Promise<any>;
}
