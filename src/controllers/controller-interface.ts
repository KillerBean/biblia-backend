export default interface IController{
    index():any;
    getVersionList():Promise<string[]>;
    getBookByID(bookID:number):Promise<any>;
    getBooksByTestament(testamentID:number):Promise<any>;
    getVerses(bookID?:number, chapterID?:number, start?: number, end?: number):Promise<any[]>;
    getBooks(search?: string):Promise<any>;
    getChapterCount(bookID: number): Promise<number[]>;
    search(query: string): Promise<any[]>;
}