import IController from './controller-interface'
class SourceController extends IController{
    index(){
        return "DEU"
    }

    getByID(id: Number) {
        return `${id}`
    }
    getVersionList(){
        return []
    }
    getBookByID(bookID:number){
        return []
    }
    getByTestament(testamentID:number){
        return []
    }
    getVerses(bookID?:number, chapterID?:number){
        return []
    }
}
export default new SourceController()