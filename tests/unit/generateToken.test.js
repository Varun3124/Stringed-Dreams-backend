const jwt = require('jsonwebtoken');
const generateToken = require('../../utils/generateToken');

describe('generateToken', () => {
  test('signs a JWT that carries the user id', () => {
    const token = generateToken('abc123');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe('abc123');
  });

  test('expires in 30 days', () => {
    const decoded = jwt.decode(generateToken('abc123'));
    expect(decoded.exp - decoded.iat).toBe(30 * 24 * 60 * 60);
  });

  test('cannot be verified with a different secret', () => {
    const token = generateToken('abc123');
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});
