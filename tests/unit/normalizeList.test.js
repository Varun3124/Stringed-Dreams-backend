const normalizeList = require('../../utils/normalizeList');

describe('normalizeList', () => {
  test('returns an empty array for null and undefined', () => {
    expect(normalizeList(undefined)).toEqual([]);
    expect(normalizeList(null)).toEqual([]);
  });

  test('splits a comma-separated string and trims entries', () => {
    expect(normalizeList(' Blue,  Red ,Green')).toEqual(['Blue', 'Red', 'Green']);
  });

  test('flattens arrays that contain comma-separated strings', () => {
    expect(normalizeList(['Blue, Red', 'Green'])).toEqual(['Blue', 'Red', 'Green']);
  });

  test('removes duplicates case-insensitively, keeping the first spelling', () => {
    expect(normalizeList(['Blue', 'blue', 'BLUE', 'Red'])).toEqual(['Blue', 'Red']);
  });

  test('drops empty entries', () => {
    expect(normalizeList(',, ,Blue,')).toEqual(['Blue']);
  });
});
