// Normalize a list value (string, comma-separated string, or array) into a
// de-duplicated array of trimmed entries. Used for multi-value product fields
// such as colors and bead types. Duplicates are compared case-insensitively.
const normalizeList = (value) => {
  if (value === undefined || value === null) return [];

  const raw = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const items = [];

  raw
    .flatMap((item) => String(item ?? '').split(','))
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    });

  return items;
};

module.exports = normalizeList;
