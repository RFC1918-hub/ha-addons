/**
 * Spike Goal 1 — Schema extraction
 * Confirmed working endpoint: GET /api/v1/tab/search?title={q}&type=Chords&limit=20
 *
 * Goals:
 * 1. Get the full response schema for tab/search
 * 2. Check marketing_type field presence (needed for Official filter)
 * 3. Test type filtering — does type=Chords filter server-side or is it ignored?
 * 4. Test artist parameter support
 * 5. Show all type and marketing_type values in an unfiltered result set
 *
 * Run with: node spike/test-ug-schema.mjs
 */

import { createHash } from 'node:crypto';

function generateClientId() {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateApiKey(clientId) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hour = String(now.getUTCHours());
  const input = `${clientId}${date}:${hour}createLog()`;
  return createHash('md5').update(input).digest('hex');
}

async function ugGet(url, clientId, apiKey) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'UGT_ANDROID/4.11.1 (Pixel; 8.1.0)',
      'Accept': 'application/json',
      'Accept-Charset': 'utf-8',
      'X-UG-CLIENT-ID': clientId,
      'X-UG-API-KEY': apiKey,
    },
    redirect: 'follow',
  });
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await res.json() : await res.text();
  return { status: res.status, body };
}

async function main() {
  const clientId = generateClientId();
  const apiKey = generateApiKey(clientId);
  const base = 'https://api.ultimate-guitar.com/api/v1';

  console.log('=== Schema Extraction Spike ===\n');

  // --- Test 1: Full unfiltered search (no type param) to see all types ---
  console.log('--- Test 1: Unfiltered search (no type param), limit=50');
  const r1 = await ugGet(`${base}/tab/search?title=wonderwall&limit=50`, clientId, apiKey);
  const tabs = r1.body.tabs || [];
  console.log(`HTTP ${r1.status}, ${tabs.length} tabs returned`);

  // All field names on first result
  if (tabs.length > 0) {
    console.log(`\nAll fields on first result:`);
    console.log(Object.keys(tabs[0]).join(', '));
    console.log('\nFirst result (full):');
    console.log(JSON.stringify(tabs[0], null, 2));
  }

  // Type distribution
  const typeCounts = {};
  tabs.forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + 1; });
  console.log('\ntype distribution:');
  Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  // marketing_type presence
  const hasMarketingType = tabs.some(t => 'marketing_type' in t);
  const marketingTypes = [...new Set(tabs.map(t => t.marketing_type).filter(x => x !== undefined))];
  console.log(`\nmarketing_type field present: ${hasMarketingType}`);
  if (hasMarketingType) console.log(`marketing_type values: ${marketingTypes.join(', ')}`);

  // Check for 'Official' tab — the ADR says filter marketing_type === "official"
  const officialTabs = tabs.filter(t => t.type === 'Official');
  console.log(`\nTabs with type==="Official": ${officialTabs.length}`);
  if (officialTabs.length > 0) {
    console.log('First Official tab:');
    const { content, ...preview } = officialTabs[0];
    console.log(JSON.stringify(preview, null, 2));
  }

  // Look for any field that signals "official" on Chords-type results
  const chordTabs = tabs.filter(t => t.type === 'Chords');
  console.log(`\nTabs with type==="Chords": ${chordTabs.length}`);
  if (chordTabs.length > 0) {
    const { content, ...preview } = chordTabs[0];
    console.log('First Chords tab:');
    console.log(JSON.stringify(preview, null, 2));
  }

  // --- Test 2: type=Chords filter — is it respected server-side? ---
  console.log('\n--- Test 2: type=Chords filter');
  const r2 = await ugGet(`${base}/tab/search?title=wonderwall&type=Chords&limit=20`, clientId, apiKey);
  const tabs2 = r2.body.tabs || [];
  console.log(`HTTP ${r2.status}, ${tabs2.length} tabs returned`);
  const types2 = [...new Set(tabs2.map(t => t.type))];
  console.log(`Unique types in response: ${types2.join(', ')}`);
  console.log(`(If still includes non-Chords types, server ignores the type param)`);

  // --- Test 3: artist parameter ---
  console.log('\n--- Test 3: artist parameter');
  const r3 = await ugGet(`${base}/tab/search?title=wonderwall&artist=oasis&limit=10`, clientId, apiKey);
  console.log(`HTTP ${r3.status}`);
  if (r3.status === 200) {
    const tabs3 = r3.body.tabs || [];
    console.log(`${tabs3.length} tabs returned`);
    const artists3 = [...new Set(tabs3.map(t => t.artist_name))];
    console.log(`Artists in response: ${artists3.join(', ')}`);
  } else {
    console.log(`Body: ${JSON.stringify(r3.body).slice(0, 200)}`);
  }

  // --- Test 4: pagination ---
  console.log('\n--- Test 4: pagination (page param)');
  const r4a = await ugGet(`${base}/tab/search?title=wonderwall&limit=5&page=1`, clientId, apiKey);
  const r4b = await ugGet(`${base}/tab/search?title=wonderwall&limit=5&page=2`, clientId, apiKey);
  console.log(`Page 1: HTTP ${r4a.status}, ${(r4a.body.tabs||[]).length} tabs`);
  console.log(`Page 2: HTTP ${r4b.status}, ${(r4b.body.tabs||[]).length} tabs`);
  if (r4a.body.tabs && r4b.body.tabs) {
    const ids1 = r4a.body.tabs.map(t => t.id);
    const ids2 = r4b.body.tabs.map(t => t.id);
    const overlap = ids1.filter(id => ids2.includes(id));
    console.log(`Page overlap: ${overlap.length} (should be 0 if pagination works)`);
  }
  // Check for pagination metadata
  const topKeys = Object.keys(r4a.body);
  console.log(`Top-level response keys: ${topKeys.join(', ')}`);

  // --- Test 5: Check if 'Official' tabs appear in Chords filter ---
  console.log('\n--- Test 5: Are Official tabs included in type=Chords filter?');
  const officialInFilter = tabs2.filter(t => t.type === 'Official');
  console.log(`Official tabs in type=Chords response: ${officialInFilter.length}`);
  if (officialInFilter.length > 0) {
    console.log('IMPORTANT: Server does NOT filter by type — must filter client-side');
    const { content, ...preview } = officialInFilter[0];
    console.log(JSON.stringify(preview, null, 2));
  } else {
    console.log('Official tabs absent — server may be filtering by type (or none in first 20)');
  }

  console.log('\n=== Schema Extraction Complete ===');
}

main().catch(err => { console.error(err); process.exit(1); });
