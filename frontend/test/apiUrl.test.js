import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiUrl } from '../src/services/apiUrl.js';

test('normalizes surrounding whitespace, quotes, backticks, and trailing slashes', () => {
  assert.equal(
    normalizeApiUrl('  `https://restify-p6wb.onrender.com/api///`  '),
    'https://restify-p6wb.onrender.com/api'
  );
  assert.equal(
    normalizeApiUrl('"http://localhost:5001/api/"'),
    'http://localhost:5001/api'
  );
});

test('rejects relative and malformed API URLs explicitly', () => {
  assert.throws(() => normalizeApiUrl('/api'), /absolute HTTP/);
  assert.throws(() => normalizeApiUrl('https:/restify-p6wb.onrender.com/api'), /absolute HTTP/);
  assert.throws(() => normalizeApiUrl('ftp://api.example.test'), /absolute HTTP/);
  assert.throws(() => normalizeApiUrl('https://api.example.test/path with space'), /absolute HTTP/);
});

test('rejects URLs containing credentials', () => {
  assert.throws(
    () => normalizeApiUrl('https://user:password@api.example.test/api'),
    /no credentials/
  );
});
