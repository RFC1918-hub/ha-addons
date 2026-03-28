import { generateApiKey } from '../src/lib/api-key.js';
import { createHash } from 'node:crypto';
import { CLIENT_ID } from '../src/lib/client-id.js';

describe('generateApiKey', () => {
  it('produces a 32-character lowercase hex string', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it('matches the expected MD5 formula', () => {
    // Fix a specific moment in time for deterministic testing
    const fixedDate = new Date('2026-03-21T08:45:00Z'); // UTC hour = 8
    const date = '2026-03-21';
    const hour = '8'; // no zero-padding

    const expected = createHash('md5')
      .update(`${CLIENT_ID}${date}:${hour}createLog()`)
      .digest('hex');

    const actual = generateApiKey(fixedDate);
    expect(actual).toBe(expected);
  });

  it('does not zero-pad single-digit hours', () => {
    // Hour 9 should be "9", not "09"
    const dateAt9 = new Date('2026-03-21T09:00:00Z');
    const key9 = generateApiKey(dateAt9);

    // Manually compute with "9" (correct) and "09" (wrong)
    const correct = createHash('md5')
      .update(`${CLIENT_ID}2026-03-21:9createLog()`)
      .digest('hex');
    const wrong = createHash('md5')
      .update(`${CLIENT_ID}2026-03-21:09createLog()`)
      .digest('hex');

    expect(key9).toBe(correct);
    expect(key9).not.toBe(wrong);
  });

  it('produces different keys for different hours', () => {
    const date1 = new Date('2026-03-21T10:00:00Z');
    const date2 = new Date('2026-03-21T11:00:00Z');
    expect(generateApiKey(date1)).not.toBe(generateApiKey(date2));
  });

  it('produces different keys for different dates', () => {
    const date1 = new Date('2026-03-21T10:00:00Z');
    const date2 = new Date('2026-03-22T10:00:00Z');
    expect(generateApiKey(date1)).not.toBe(generateApiKey(date2));
  });
});
