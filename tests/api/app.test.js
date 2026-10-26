// HTTP-level tests that need no database: they exercise routing, auth guards and the
// health check through the real Express app.
const request = require('supertest');
const app = require('../../app');

describe('API without a database', () => {
  test('GET / reports the API is running', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/running/i);
  });

  test('GET /api/health returns 503 while MongoDB is not connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', db: 'disconnected' });
    expect(typeof res.body.uptime).toBe('number');
  });

  test('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Not Found - /api/does-not-exist');
  });

  test('profile requires a token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  test('admin routes require a token', async () => {
    const res = await request(app).get('/api/admin/products');
    expect(res.status).toBe(401);
  });

  test('CORS allows the configured frontend origin', async () => {
    const res = await request(app).get('/').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
