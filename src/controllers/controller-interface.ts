abstract class IController{
    index(){}
    getVersionList(){}
    getBookByID(bookID:number){}
    getByTestament(testamentID:number){}
    getVerses(bookID?:number, chapterID?:number){}
}

export default IController