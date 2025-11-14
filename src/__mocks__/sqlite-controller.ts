
import IController from '../controllers/controller-interface';

class MockSqliteController implements IController {
    
    // Mock implementations for each method in the interface
    index = jest.fn(() => ({ message: 'Mocked welcome message' }));
    
    getVersionList = jest.fn(async () => ['mock_version']);
    
    getBookByID = jest.fn(async (bookID: number) => ({ id: bookID, name: 'Mock Book' }));
    
    getBooks = jest.fn(async () => [{ id: 1, name: 'Mock Book' }]);
    
    getBooksByTestament = jest.fn(async (testamentID: number) => [{ id: 1, testament: testamentID, name: 'Mock Book' }]);
    
    getVerses = jest.fn(async (bookID?: number, chapterID?: number) => [{ id: 1, book: bookID, chapter: chapterID, text: 'Mock Verse' }]);
    
    // A static create method to mimic the original class, but for the mock
    static async create(): Promise<MockSqliteController> {
        return new MockSqliteController();
    }
}

export default MockSqliteController;
