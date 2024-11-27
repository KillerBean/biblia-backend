import IController from './controller-interface'
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

class SourceController extends IController{
    index(){
        return "DEU"
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