import { jest } from '@jest/globals';
import IController from '../controllers/controller-interface.ts';

class MockSqliteController implements IController {
    dbController = undefined; // Add missing property
    init = jest.fn(); // Add missing method
    getByID = jest.fn((id: number) => (`${id}`));
    
    // Mock implementations for each method in the interface
    index = jest.fn(() => ({ message: 'Mocked welcome message' }));
    
    getVersionList = jest.fn(async () => ['mock_version']);
    
    getBookByID = jest.fn(async (bookID: number) => {
        if (bookID === 999) return null; // Simulate not found
        return { id: bookID, name: 'Mock Book' };
    });
    
    getBooks = jest.fn(async (search?: string) => {
        if (search === 'NonExistent') return [];
        return [{ id: 1, name: 'Mock Book' }];
    });
    
    getChapterCount = jest.fn(async (bookID: number) => {
        if (bookID === 999) return []; // Simulate not found/empty
        return [1, 2, 3];
    });

    getBooksByTestament = jest.fn(async (testamentID: number) => [{ id: 1, testament: testamentID, name: 'Mock Book' }]);
    
    getVerses = jest.fn(async (bookID?: number, chapterID?: number, start?: number, end?: number) => {
        return [{ 
            id: 1, 
            verse: 1, 
            chapter: chapterID || 1, 
            text: 'Mock Verse',
            book: { id: bookID || 1, name: 'Mock Book' } 
        }];
    });
    
    search = jest.fn(async (query: string) => [{ 
        id: 1, 
        text: 'Mock Search Result',
        book: { id: 1, name: 'Mock Book' }
    }]);

    // A static create method to mimic the original class, but for the mock
    static async create(): Promise<MockSqliteController> {
        return new MockSqliteController();
    }
}

export default MockSqliteController;