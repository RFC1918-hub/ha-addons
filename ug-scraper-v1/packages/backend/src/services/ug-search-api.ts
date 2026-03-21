/**
 * UG Android API search — Option D (confirmed working in spike).
 *
 * Confirmed endpoint: GET /api/v1/tab/search?title={q}&limit=20
 *
 * Spike findings:
 * - Parameter name is "title" NOT "q" (ADR assumed "q" — corrected here)
 * - "type" parameter is accepted but NOT respected server-side: all tab types
 *   are returned regardless of the type filter. Filtering must be done client-side.
 * - "artist" parameter accepted; returns results for that artist only (tested: works)
 * - Pagination supported via "page" parameter
 * - "marketing_type" field is NOT present in search results
 * - Official tabs are identified by type === "Official"
 * - Response structure: { tabs: TabSummary[], artists: unknown[] }
 */

import { CLIENT_ID, generateApiKey } from '../lib/api-key.js';

const UG_API_BASE = 'https://api.ultimate-guitar.com/api/v1';

function androidHeaders(): Record<string, string> {
  return {
    'User-Agent': 'UGT_ANDROID/4.11.1 (Pixel; 8.1.0)',
    Accept: 'application/json',
    'Accept-Charset': 'utf-8',
    'X-UG-CLIENT-ID': CLIENT_ID,
    'X-UG-API-KEY': generateApiKey(),
  };
}

export interface TabSummary {
  id: number;
  song_name: string;
  artist_name: string;
  type: string;
  rating: number;
  votes: number;
  difficulty: string;
  capo: number;
  tuning: string;
  tonality_name: string;
}

interface RawTab {
  id: number;
  song_name: string;
  artist_name: string;
  type: string;
  rating: number;
  votes: number;
  difficulty: string;
  capo: number;
  tuning: string;
  tonality_name: string;
}

/**
 * Search for tabs by title and optional artist.
 * Returns only Chords-type results, sorted by rating descending (votes as tiebreaker).
 * Official tabs and Pro/Guitar Pro tabs are excluded.
 */
export async function searchTabs(
  title: string,
  artist?: string,
  limit = 50
): Promise<TabSummary[]> {
  const params = new URLSearchParams({ title, limit: String(limit) });
  if (artist) params.set('artist', artist);

  const url = `${UG_API_BASE}/tab/search?${params.toString()}`;
  const res = await fetch(url, { headers: androidHeaders() });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`UG search API returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { tabs?: RawTab[] };
  const rawTabs = data.tabs ?? [];

  // Client-side filtering (server ignores the type param — confirmed in spike)
  const filtered = rawTabs.filter(
    (t) =>
      t.type === 'Chords' // keep only Chords
    // Official tabs in the UG Android API have type === "Official", not a separate
    // marketing_type field. Filter them out.
    // Pro/Guitar Pro come through as type === "Pro" — also excluded by the Chords check.
  );

  // Sort: rating descending, votes descending as tiebreaker
  filtered.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.votes - a.votes;
  });

  return filtered.map((t) => ({
    id: t.id,
    song_name: t.song_name,
    artist_name: t.artist_name,
    type: t.type,
    rating: t.rating,
    votes: t.votes,
    difficulty: t.difficulty ?? '',
    capo: t.capo ?? 0,
    tuning: t.tuning ?? '',
    tonality_name: t.tonality_name ?? '',
  }));
}
