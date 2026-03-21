/**
 * Spike Goal 1 — UG Android API Search
 * Tests whether any UG Android API endpoint supports search.
 * Also validates the tab fetch API key formula.
 *
 * Run with: node spike/test-ug-api.mjs
 */

import { createHash } from 'node:crypto';

// --- API key generation (mirrors ADR formula) ---

function generateClientId() {
  // 16-char lowercase hex
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
  const date = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const hour = String(now.getUTCHours()); // no zero-padding
  const input = `${clientId}${date}:${hour}createLog()`;
  return createHash('md5').update(input).digest('hex');
}

// --- HTTP helper ---

async function ugGet(url, clientId, apiKey) {
  const headers = {
    'User-Agent': 'UGT_ANDROID/4.11.1 (Pixel; 8.1.0)',
    'Accept': 'application/json',
    'Accept-Charset': 'utf-8',
    'X-UG-CLIENT-ID': clientId,
    'X-UG-API-KEY': apiKey,
  };

  try {
    const res = await fetch(url, {
      headers,
      // Disable auto-decompression: Node's built-in fetch (undici) does NOT
      // automatically set Accept-Encoding, so no action needed. We explicitly
      // avoid setting it to match the Android client behaviour.
      redirect: 'follow',
    });

    let body = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
    } else {
      body = await res.text();
    }

    return { status: res.status, body };
  } catch (err) {
    return { status: null, body: null, error: err.message };
  }
}

function summariseBody(body) {
  if (body === null) return 'null';
  if (typeof body === 'string') {
    return body.slice(0, 300) + (body.length > 300 ? '…' : '');
  }
  const json = JSON.stringify(body, null, 2);
  return json.slice(0, 800) + (json.length > 800 ? '\n…' : '');
}

function checkSearchSuccess(body) {
  // Success: JSON body containing an array (or object with array) that has
  // objects with id, song_name, artist_name, type, rating fields.
  if (!body || typeof body !== 'object') return false;

  let candidates = [];

  // Could be an array directly
  if (Array.isArray(body)) {
    candidates = body;
  } else {
    // Walk one level deep to find an array of result objects
    for (const val of Object.values(body)) {
      if (Array.isArray(val) && val.length > 0) {
        candidates = val;
        break;
      }
    }
  }

  if (candidates.length === 0) return false;

  const first = candidates[0];
  if (typeof first !== 'object') return false;

  // Check for required fields
  const required = ['id', 'song_name', 'artist_name'];
  return required.every((f) => f in first);
}

// --- Main spike ---

async function main() {
  const clientId = generateClientId();
  const apiKey = generateApiKey(clientId);

  console.log('=== UG Android API Spike ===');
  console.log(`X-UG-CLIENT-ID : ${clientId}`);
  console.log(`X-UG-API-KEY   : ${apiKey}`);
  console.log('');

  // ----- GOAL 1: Search endpoints -----

  const searchEndpoints = [
    'https://api.ultimate-guitar.com/api/v1/tab/search?q=wonderwall&type=Chords&limit=20',
    'https://api.ultimate-guitar.com/api/v1/search?q=wonderwall&type=Chords&limit=20',
    'https://api.ultimate-guitar.com/api/v1/autocomplete/suggest?q=wonderwall&type=Chords',
    'https://api.ultimate-guitar.com/api/v1/store/suggest?q=wonderwall',
    'https://api.ultimate-guitar.com/api/v1/search/suggest?q=wonderwall',
  ];

  let successEndpoint = null;
  let successBody = null;

  for (const url of searchEndpoints) {
    console.log(`--- Testing: ${url}`);
    const result = await ugGet(url, clientId, apiKey);

    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
    } else {
      console.log(`  HTTP ${result.status}`);
      if (result.status === 200) {
        const isSuccess = checkSearchSuccess(result.body);
        console.log(`  Search success check: ${isSuccess}`);
        console.log('  Body preview:');
        console.log(
          summariseBody(result.body)
            .split('\n')
            .map((l) => '    ' + l)
            .join('\n')
        );

        if (isSuccess && !successEndpoint) {
          successEndpoint = url;
          successBody = result.body;
          console.log('  *** SUCCESS — search results found ***');

          // Test with artist parameter if the endpoint looks like it might support it
          if (url.includes('/tab/search') || url.includes('/search?')) {
            const withArtist = url + '&artist=oasis';
            console.log(`\n  Testing artist parameter: ${withArtist}`);
            const artistResult = await ugGet(withArtist, clientId, apiKey);
            console.log(`  HTTP ${artistResult.status}`);
            if (artistResult.status === 200) {
              console.log('  Artist param body preview:');
              console.log(
                summariseBody(artistResult.body)
                  .split('\n')
                  .map((l) => '    ' + l)
                  .join('\n')
              );
            }
          }
        }
      } else {
        // Still show a short body preview for non-200 responses
        console.log('  Body preview:');
        console.log(
          summariseBody(result.body)
            .split('\n')
            .map((l) => '    ' + l)
            .join('\n')
        );
      }
    }
    console.log('');
  }

  // ----- GOAL 1: Schema report if success -----

  if (successEndpoint) {
    console.log('=== SEARCH SUCCESS — Schema Report ===');
    console.log(`Endpoint: ${successEndpoint}`);

    // Extract result array
    let results = [];
    if (Array.isArray(successBody)) {
      results = successBody;
    } else {
      for (const val of Object.values(successBody)) {
        if (Array.isArray(val)) {
          results = val;
          break;
        }
      }
    }

    if (results.length > 0) {
      const first = results[0];
      console.log(`\nFirst result fields: ${Object.keys(first).join(', ')}`);
      console.log('\nFirst result (full):');
      console.log(JSON.stringify(first, null, 2));

      // Show marketing_type and type values across all results for filter validation
      const types = [...new Set(results.map((r) => r.type).filter(Boolean))];
      const marketingTypes = [
        ...new Set(results.map((r) => r.marketing_type).filter(Boolean)),
      ];
      console.log(`\ntype values present: ${types.join(', ')}`);
      console.log(`marketing_type values present: ${marketingTypes.join(', ')}`);
    }
    console.log('');
  } else {
    console.log('=== SEARCH: All Option D endpoints failed ===');
    console.log('Proceeding to validate tab fetch only.');
    console.log('');
  }

  // ----- Tab fetch validation (always runs) -----

  console.log('=== Tab Fetch Validation ===');
  // Use the confirmed working tab ID from the ADR
  const tabId = 2313717;
  const tabUrl = `https://api.ultimate-guitar.com/api/v1/tab/info?tab_id=${tabId}&tab_access_type=private`;
  console.log(`URL: ${tabUrl}`);

  // Regenerate key to ensure freshness (formula test)
  const tabClientId = generateClientId();
  const tabApiKey = generateApiKey(tabClientId);
  console.log(`X-UG-CLIENT-ID : ${tabClientId}`);
  console.log(`X-UG-API-KEY   : ${tabApiKey}`);

  const tabResult = await ugGet(tabUrl, tabClientId, tabApiKey);

  if (tabResult.error) {
    console.log(`ERROR: ${tabResult.error}`);
  } else {
    console.log(`HTTP ${tabResult.status}`);
    if (tabResult.status === 200 && tabResult.body) {
      const tab = tabResult.body.tab || tabResult.body;
      const topLevelKeys = Object.keys(tabResult.body);
      console.log(`Top-level keys: ${topLevelKeys.join(', ')}`);
      if (tab && typeof tab === 'object') {
        console.log(`Tab fields: ${Object.keys(tab).join(', ')}`);
        // Show content snippet (first 200 chars)
        if (tab.content) {
          const contentPreview = String(tab.content).slice(0, 200);
          console.log(`Content preview: ${contentPreview}`);
        }
        // Show key metadata
        console.log(`song_name: ${tab.song_name}`);
        console.log(`artist_name: ${tab.artist_name}`);
        console.log(`type: ${tab.type}`);
        console.log(`rating: ${tab.rating}`);
        console.log(`tonality_name: ${tab.tonality_name}`);
        console.log(`capo: ${tab.capo}`);
        console.log(`tuning: ${tab.tuning}`);
      }
    } else {
      console.log('Body preview:');
      console.log(summariseBody(tabResult.body));
    }
  }
  console.log('');

  console.log('=== Spike Goal 1 Complete ===');
  if (successEndpoint) {
    console.log('RESULT: Option D SUCCEEDED — Android API search is available.');
    console.log(`Working endpoint: ${successEndpoint}`);
    console.log('No Playwright spike needed.');
  } else {
    console.log('RESULT: Option D FAILED — No Android API search endpoint found.');
    console.log('Proceed to Spike Goal 2 (Playwright).');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
