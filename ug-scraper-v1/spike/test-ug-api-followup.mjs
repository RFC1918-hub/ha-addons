/**
 * Spike Goal 1 — Follow-up: endpoint 1 returned 400 "Missing required parameter 'title'"
 * This means the endpoint EXISTS and accepts requests. Test with correct parameter name.
 * Also test additional parameter variations.
 *
 * Run with: node spike/test-ug-api-followup.mjs
 */

import { createHash } from 'node:crypto';

function generateClientId() {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateApiKey(clientId) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hour = String(now.getUTCHours());
  const input = `${clientId}${date}:${hour}createLog()`;
  return createHash('md5').update(input).digest('hex');
}

async function ugGet(url, clientId, apiKey) {
  const headers = {
    'User-Agent': 'UGT_ANDROID/4.11.1 (Pixel; 8.1.0)',
    'Accept': 'application/json',
    'Accept-Charset': 'utf-8',
    'X-UG-CLIENT-ID': clientId,
    'X-UG-API-KEY': apiKey,
  };

  try {
    const res = await fetch(url, { headers, redirect: 'follow' });
    let body = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try { body = await res.json(); } catch { body = await res.text(); }
    } else {
      body = await res.text();
    }
    return { status: res.status, body };
  } catch (err) {
    return { status: null, body: null, error: err.message };
  }
}

function summariseBody(body, maxLen = 2000) {
  if (body === null) return 'null';
  const json = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  return json.slice(0, maxLen) + (json.length > maxLen ? '\n…(truncated)' : '');
}

function checkSearchSuccess(body) {
  if (!body || typeof body !== 'object') return false;
  let candidates = Array.isArray(body) ? body : [];
  if (!candidates.length) {
    for (const val of Object.values(body)) {
      if (Array.isArray(val) && val.length > 0) { candidates = val; break; }
    }
  }
  if (!candidates.length) return false;
  const first = candidates[0];
  if (typeof first !== 'object') return false;
  return ['id', 'song_name', 'artist_name'].every((f) => f in first);
}

async function test(label, url, clientId, apiKey) {
  console.log(`--- ${label}`);
  console.log(`    URL: ${url}`);
  const result = await ugGet(url, clientId, apiKey);
  if (result.error) {
    console.log(`    ERROR: ${result.error}`);
  } else {
    console.log(`    HTTP ${result.status}`);
    const success = result.status === 200 && checkSearchSuccess(result.body);
    if (success) console.log('    *** SEARCH SUCCESS ***');
    console.log('    Body:');
    console.log(summariseBody(result.body).split('\n').map(l => '      ' + l).join('\n'));
  }
  console.log('');
  return result;
}

async function main() {
  const clientId = generateClientId();
  const apiKey = generateApiKey(clientId);

  console.log('=== UG Android API Follow-up Spike ===');
  console.log(`X-UG-CLIENT-ID : ${clientId}`);
  console.log(`X-UG-API-KEY   : ${apiKey}`);
  console.log('');

  const base = 'https://api.ultimate-guitar.com/api/v1';

  // Endpoint 1 said "Missing required parameter 'title'" — try with title param
  await test('tab/search with title param', `${base}/tab/search?title=wonderwall&type=Chords&limit=20`, clientId, apiKey);
  await test('tab/search with title + no type', `${base}/tab/search?title=wonderwall&limit=20`, clientId, apiKey);
  await test('tab/search with title + type=Chords + page', `${base}/tab/search?title=wonderwall&type=Chords&limit=20&page=1`, clientId, apiKey);

  // Try search endpoint with different params
  await test('search with title param', `${base}/search?title=wonderwall&type=Chords&limit=20`, clientId, apiKey);
  await test('search with value param', `${base}/search?value=wonderwall&type=Chords&limit=20`, clientId, apiKey);

  // Try some other potential endpoint patterns
  await test('tabs/search', `${base}/tabs/search?title=wonderwall&type=Chords&limit=20`, clientId, apiKey);
  await test('tab/search with search_type param', `${base}/tab/search?title=wonderwall&search_type=title&limit=20`, clientId, apiKey);

  // Try the suggest endpoint with title param
  await test('autocomplete/suggest with title', `${base}/autocomplete/suggest?title=wonderwall&type=Chords`, clientId, apiKey);

  console.log('=== Follow-up Complete ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
