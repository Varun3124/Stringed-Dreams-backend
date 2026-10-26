const { admin } = require('../../middleware/admin');
const { protect } = require('../../middleware/auth');
const { errorHandler, notFound } = require('../../middleware/error');

// Minimal Express-like response object
const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn(() => res);
  return res;
};

describe('admin middleware', () => {
  test('lets admins through', () => {
    const next = jest.fn();
    admin({ user: { role: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects normal users with 403', () => {
    const res = mockRes();
    const next = jest.fn();
    admin({ user: { role: 'user' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects requests without a user with 403', () => {
    const res = mockRes();
    admin({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('protect middleware', () => {
  test('rejects a request with no Authorization header', async () => {
    const res = mockRes();
    const next = jest.fn();
    await protect({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an invalid token', async () => {
    const res = mockRes();
    const next = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await protect({ headers: { authorization: 'Bearer not-a-real-token' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    console.error.mockRestore();
  });
});

describe('error middleware', () => {
  test('notFound sets 404 and forwards an error', () => {
    const res = mockRes();
    const next = jest.fn();
    notFound({ originalUrl: '/nope' }, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next.mock.calls[0][0].message).toBe('Not Found - /nope');
  });

  test('errorHandler turns an unset status into 500', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe('boom');
  });

  test('errorHandler hides the stack trace in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    errorHandler(new Error('boom'), {}, res, jest.fn());
    expect(res.json.mock.calls[0][0].stack).toBeNull();
    process.env.NODE_ENV = previous;
  });
});
