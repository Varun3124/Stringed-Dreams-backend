// End-to-end API tests against a real MongoDB. They run when MONGODB_URI_TEST is set:
// in GitHub Actions (a mongo service container) or locally with
//   docker compose up -d mongo
//   MONGODB_URI_TEST=mongodb://localhost:27017/stringed-dreams-test npm run test:integration
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Product = require('../../models/Product');

const uri = process.env.MONGODB_URI_TEST;
const describeIfDb = uri ? describe : describe.skip;

describeIfDb('API with MongoDB', () => {
  const user = { name: 'Test User', email: 'test@example.com', password: 'secret123' };
  let token;

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    await User.init(); // build the unique email index before testing duplicates
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  test('health check is ok once connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });

  test('registers a user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: user.name, email: user.email, role: 'user' });
    expect(res.body.token).toBeDefined();
    expect(res.body.password).toBeUndefined();
  });

  test('refuses a duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(400);
  });

  test('stores the password hashed', async () => {
    const stored = await User.findOne({ email: user.email }).select('+password');
    expect(stored.password).not.toBe(user.password);
    expect(await stored.matchPassword(user.password)).toBe(true);
  });

  test('logs in with the right password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    token = res.body.token;
    expect(token).toBeDefined();
  });

  test('rejects a wrong password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  test('returns the profile for a valid token', async () => {
    const res = await request(app).get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });

  test('blocks normal users from admin routes', async () => {
    const res = await request(app).get('/api/admin/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('lists products without inline images', async () => {
    await Product.create({ name: 'Blue Bead Bracelet', price: 500, discountPrice: 450, stock: 3 });
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body.products;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Blue Bead Bracelet');
  });
});
