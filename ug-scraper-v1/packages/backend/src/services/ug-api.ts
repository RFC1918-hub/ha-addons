/**
 * UG Android API client — tab fetch.
 *
 * Endpoint: GET /api/v1/tab/info?tab_id={id}&tab_access_type=private
 *
 * Spike confirmed: tab fetch with Android headers returns HTTP 200.
 * Response top-level keys are the tab object directly (not nested under "tab").
 */

import { CLIENT_ID, generateApiKey } from '../lib/api-key.js';
import { parseContent, ContentNode } from './content-parser.js';
import { formatOnSong } from './onsong-formatter.js';

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

export interface TabDetail {
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
  content: ContentNode[];
  onsong: string;
}

export async function fetchTab(tabId: number): Promise<TabDetail> {
  const url = `${UG_API_BASE}/tab/info?tab_id=${tabId}&tab_access_type=private`;
  const res = await fetch(url, { headers: androidHeaders() });

  if (res.status === 404) {
    const err = new Error('Tab not found');
    (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`UG API returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // Spike: response keys are at the top level (no "tab" wrapper key for the tab object).
  // The tab fields are directly on the response body.
  const raw = data as {
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
    content: string;
  };

  const rawData = {
    id: raw.id,
    song_name: raw.song_name,
    artist_name: raw.artist_name,
    type: raw.type,
    rating: raw.rating,
    votes: raw.votes,
    difficulty: raw.difficulty ?? '',
    capo: raw.capo ?? 0,
    tuning: raw.tuning ?? '',
    tonality_name: raw.tonality_name ?? '',
    content: raw.content ?? '',
  };

  return {
    ...rawData,
    content: parseContent(rawData.content),
    onsong: formatOnSong(rawData),
  };
}
