
import request from 'supertest';
import express from 'express';
import SqliteController from './controllers/sqlite-controller';
import MockSqliteController from './__mocks__/sqlite-controller';

// Mock the entire module
jest.mock('./controllers/sqlite-controller');

let app: express.Application;

describe('API Endpoints', () => {
  let mockController: MockSqliteController;

  beforeAll(async () => {
    // 1. Create the mock controller instance
    mockController = await MockSqliteController.create();
    
    // 2. Configure the mock for the static `create` method BEFORE importing the router
    (SqliteController.create as jest.Mock).mockResolvedValue(mockController as any);

    // 3. Now, dynamically import the router
    const apiRouter = (await import('./router')).createApiRouter(mockController as any);

    // 4. Initialize the app with the router
    app = express();
    app.use('/', apiRouter);
  });


  it('GET / should return a welcome message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message');
  });

  it('GET /books should return an array of books', async () => {
    const res = await request(app).get('/books');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    // You can also check if the mock function was called
    expect(mockController.getBooks).toHaveBeenCalled();
  });

  it('GET /books/:bookId should return a single book', async () => {
    const res = await request(app).get('/books/1');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id');
    expect(mockController.getBookByID).toHaveBeenCalledWith(1);
  });

  it('GET /books/:bookId with invalid ID should return 400', async () => {
    const res = await request(app).get('/books/invalid');
    expect(res.statusCode).toEqual(400);
  });

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
    expect(mockController.getVerses).toHaveBeenCalledWith(1, 1);
  });

  it('GET /verses/:bookId/:chapterId with invalid IDs should return 400', async () => {
    const res = await request(app).get('/verses/invalid/invalid');
    expect(res.statusCode).toEqual(400);
  });

  it('GET /versions should return an array of versions', async () => {
    const res = await request(app).get('/versions');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockController.getVersionList).toHaveBeenCalled();
  });
});