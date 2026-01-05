import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import MockSqliteController from './__mocks__/sqlite-controller.ts';

// Mocking for ESM requires unstable_mockModule
jest.unstable_mockModule('./services/redis-service.ts', () => ({
  default: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
  },
}));

// Mock the entire controller module (this one seems to work fine with standard mock, but for consistency...)
jest.mock('./controllers/sqlite-controller.ts');

let app: express.Application;
let mockController: MockSqliteController;

describe('API Endpoints', () => {
  beforeAll(async () => {
    // Import router dynamically AFTER mocking
    const { createApiRouter } = await import('./router.ts');
    
    mockController = await MockSqliteController.create();
    const apiRouter = createApiRouter(mockController);
    app = express();
    app.use('/', apiRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });


  it('GET / should return a welcome message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message');
  });

  // --- Books Tests ---

  it('GET /books should return an array of books', async () => {
    const res = await request(app).get('/books');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockController.getBooks).toHaveBeenCalledWith(undefined);
  });

  it('GET /books?name=... should return filtered books', async () => {
    const res = await request(app).get('/books?name=Mock');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockController.getBooks).toHaveBeenCalledWith('Mock');
  });

  it('GET /books/:bookId should return a single book', async () => {
    const res = await request(app).get('/books/1');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id');
    expect(mockController.getBookByID).toHaveBeenCalledWith(1);
  });

  it('GET /books/:bookId should return 404 if not found', async () => {
    // Mock controller is set to return null for ID 999
    const res = await request(app).get('/books/999');
    expect(res.statusCode).toEqual(404);
  });

  it('GET /books/:bookId with invalid ID should return 400', async () => {
    const res = await request(app).get('/books/invalid');
    expect(res.statusCode).toEqual(400);
  });

  // --- Chapter Count Tests ---

  it('GET /books/:bookId/chapters should return list of chapters', async () => {
    const res = await request(app).get('/books/1/chapters');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Mock returns [1, 2, 3]
    expect(res.body).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(mockController.getChapterCount).toHaveBeenCalledWith(1);
  });

  it('GET /books/:bookId/chapters should return 404 if book not found', async () => {
    const res = await request(app).get('/books/999/chapters');
    expect(res.statusCode).toEqual(404);
  });

  it('GET /books/:bookId/chapters with invalid ID should return 400', async () => {
    const res = await request(app).get('/books/invalid/chapters');
    expect(res.statusCode).toEqual(400);
  });

  // --- Testament Tests ---

  it('GET /books/testament/:testamentId should return books from a testament', async () => {
    const res = await request(app).get('/books/testament/1');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockController.getBooksByTestament).toHaveBeenCalledWith(1);
  });

  it('GET /books/testament/:testamentId with invalid ID should return 400', async () => {
    const res = await request(app).get('/books/testament/invalid');
    expect(res.statusCode).toEqual(400);
  });

  // --- Verse Tests ---

  it('GET /verses/:bookId should return verses from a book', async () => {
    const res = await request(app).get('/verses/1');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockController.getVerses).toHaveBeenCalledWith(1);
  });

  it('GET /verses/:bookId with invalid ID should return 400', async () => {
    const res = await request(app).get('/verses/invalid');
    expect(res.statusCode).toEqual(400);
  });

  it('GET /verses/:bookId/:chapterId should return verses from a chapter', async () => {
    const res = await request(app).get('/verses/1/1');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockController.getVerses).toHaveBeenCalledWith(1, 1, undefined, undefined);
  });

  it('GET /verses/:bookId/:chapterId with range params should pass them', async () => {
    const res = await request(app).get('/verses/1/1?start=5&end=10');
    expect(res.statusCode).toEqual(200);
    expect(mockController.getVerses).toHaveBeenCalledWith(1, 1, 5, 10);
  });

  it('GET /verses/:bookId/:chapterId with invalid IDs should return 400', async () => {
    const res = await request(app).get('/verses/invalid/invalid');
    expect(res.statusCode).toEqual(400);
  });
  
  it('GET /verses/... should return verses with book object', async () => {
    const res = await request(app).get('/verses/1/1');
    expect(res.statusCode).toEqual(200);
    expect(res.body[0]).toHaveProperty('book');
    expect(res.body[0].book).toHaveProperty('id');
    expect(res.body[0].book).toHaveProperty('name');
  });

  // --- Other Tests ---

  it('GET /versions should return an array of versions', async () => {
    const res = await request(app).get('/versions');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockController.getVersionList).toHaveBeenCalled();
  });

  it('GET /search should return search results', async () => {
    const res = await request(app).get('/search?query=Deus');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockController.search).toHaveBeenCalledWith('Deus');
  });

  it('GET /search should return 400 if query is missing', async () => {
    const res = await request(app).get('/search');
    expect(res.statusCode).toEqual(400);
  });
});