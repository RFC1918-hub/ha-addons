import { CLIENT_ID } from '../src/lib/client-id.js';

describe('CLIENT_ID', () => {
  it('is a 16-character lowercase hex string', () => {
    expect(CLIENT_ID).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable across multiple imports (singleton)', async () => {
    const { CLIENT_ID: id2 } = await import('../src/lib/client-id.js');
    expect(CLIENT_ID).toBe(id2);
  });
});
