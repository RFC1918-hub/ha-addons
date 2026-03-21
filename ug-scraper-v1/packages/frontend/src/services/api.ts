/**
 * Typed fetch wrappers for all three backend API endpoints.
 * All functions throw an Error with the server's error message on non-2xx responses.
 */

// ---------- Shared types ----------

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

export type Token =
  | { type: 'text'; value: string }
  | { type: 'chord'; value: string }
  | { type: 'tab-block'; lines: string[] };

export type ContentNode =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; tokens: Token[] };

export interface TabDetail {
  id: number;
  song_name: string;
  artist_name: string;
  rating: number;
  votes: number;
  difficulty: string;
  capo: number;
  tuning: string;
  tonality_name: string;
  content: ContentNode[];
  onsong: string;
}

export interface SearchResponse {
  results: TabSummary[];
}

export interface TabResponse {
  tab: TabDetail;
}

// ---------- Helpers ----------

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ---------- API functions ----------

export async function searchTabs(
  q: string,
  artist?: string
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q });
  if (artist) params.set('artist', artist);
  const res = await fetch(`/api/search?${params.toString()}`);
  return handleResponse<SearchResponse>(res);
}

export async function fetchTab(id: number): Promise<TabResponse> {
  const res = await fetch(`/api/tab/${id}`);
  return handleResponse<TabResponse>(res);
}

export async function resolveUrl(url: string): Promise<{ id: number }> {
  const res = await fetch('/api/resolve-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return handleResponse<{ id: number }>(res);
}

export async function getOnSongConfig(): Promise<{ configured: boolean }> {
  const res = await fetch('/api/onsong/config');
  return handleResponse<{ configured: boolean }>(res);
}

export async function sendToOnSong(
  title: string,
  artist: string,
  content: string
): Promise<{ success: boolean; filename: string }> {
  const res = await fetch('/api/onsong/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, artist, content }),
  });
  return handleResponse<{ success: boolean; filename: string }>(res);
}
