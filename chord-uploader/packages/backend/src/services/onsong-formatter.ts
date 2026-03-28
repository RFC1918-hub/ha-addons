/**
 * OnSong plain-text chord chart formatter.
 * Converts a raw UG API tab response into OnSong format.
 *
 * OnSong format reference:
 *   https://onsongapp.com/docs/features/formats/onsong/
 *
 * Handles two UG content styles:
 *   Style A — inline [ch]X[/ch] tags (modern UG)
 *   Style B — separate bare chord lines (older UG, no [ch] tags)
 */

export interface RawTabData {
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
}

/** Standard tuning forms — omit from header when any of these match. */
const STANDARD_TUNINGS = new Set(['E A D G B E', 'EADGBe', 'EADGBE']);

/**
 * Section keyword list. A bracketed standalone line is treated as a section
 * label only when its text starts with one of these words (case-insensitive),
 * or when the first word is purely numeric (e.g. "2", used in "Verse 2").
 */
const SECTION_KEYWORDS = new Set([
  'verse',
  'chorus',
  'bridge',
  'intro',
  'outro',
  'pre-chorus',
  'prechorus',
  'interlude',
  'tag',
  'solo',
  'break',
  'hook',
  'coda',
  'instrumental',
  'turnaround',
]);

/**
 * Matches a chord token as defined in the spec.
 * A bare token (no brackets) that looks like a valid chord symbol.
 */
const CHORD_TOKEN_RE =
  /^[A-G][#b]?(?:[0-9]+)?(?:maj|min|m|M|sus[24]?|aug|dim|add|no)?(?:[0-9]+)?(?:[#b][0-9]+)*(?:\/[A-G][#b]?)?$/;

/** Matches a standalone UG section label line: [Verse 1], [Chorus], etc. */
const UG_SECTION_LINE_RE = /^\[([^\]]+)\]\s*$/;

/**
 * Returns true when the text of a bracketed label should be treated as a
 * section heading rather than a chord or other annotation.
 */
function isSectionLabel(text: string): boolean {
  const first = text.trim().split(/\s+/)[0].toLowerCase();
  // Allow numeric-prefixed labels like "2" in "Verse 2" when standalone
  if (/^\d+$/.test(first)) return true;
  return SECTION_KEYWORDS.has(first);
}

/**
 * Returns true when every whitespace-separated token on `line` is a valid
 * chord symbol AND the line is non-empty AND is not a section label.
 */
function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return false;
  // Bracketed section label lines are not chord lines
  if (UG_SECTION_LINE_RE.test(trimmed)) return false;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;
  return tokens.every((t) => CHORD_TOKEN_RE.test(t));
}

/**
 * Convert a Style B bare chord line to OnSong format.
 * Replaces each chord token in-place, preserving surrounding whitespace.
 * Example: "Em7     G       Dsus4" → "[Em7]   [G]     [Dsus4]"
 */
function wrapChordLine(line: string): string {
  // Replace each chord-shaped token (as a whole word at word boundary) in-place.
  // We walk through tokens separated by whitespace, preserving spacing by
  // splitting on runs of whitespace and re-joining.
  return line.replace(/\S+/g, (token) => {
    if (CHORD_TOKEN_RE.test(token)) {
      return `[${token}]`;
    }
    return token;
  });
}

/**
 * Collapse 3 or more consecutive blank lines down to exactly 2.
 */
function collapseBlankLines(lines: string[]): string[] {
  const result: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      blankRun++;
      if (blankRun <= 2) result.push(line);
    } else {
      blankRun = 0;
      result.push(line);
    }
  }
  return result;
}

/**
 * Process content in Style A (has [ch] tags).
 * - Strip [tab] / [/tab] wrapper tags (keep inner content)
 * - Convert [ch]X[/ch] → [X]
 * - Convert standalone [Section Label] lines → Section Label:
 * - Pass everything else through unchanged
 */
function processStyleA(content: string): string[] {
  // Strip [tab] and [/tab] wrapper tags — keep their content
  let text = content.replace(/\[tab\]/gi, '').replace(/\[\/tab\]/gi, '');

  // Convert [ch]X[/ch] → [X]
  text = text.replace(/\[ch\](.*?)\[\/ch\]/gi, '[$1]');

  const lines = text.split('\n');
  return lines.map((line) => {
    const stripped = line.trimEnd();
    const match = UG_SECTION_LINE_RE.exec(stripped);
    if (match && isSectionLabel(match[1])) {
      return `${match[1]}:`;
    }
    return stripped;
  });
}

/**
 * Process content in Style B (no [ch] tags).
 * - Strip [tab] / [/tab] wrapper tags
 * - Convert standalone [Section Label] lines → Section Label:
 * - Detect bare chord lines and wrap each token in []
 * - Pass lyric lines through unchanged
 */
function processStyleB(content: string): string[] {
  // Strip [tab] and [/tab] wrapper tags — keep their content
  let text = content.replace(/\[tab\]/gi, '').replace(/\[\/tab\]/gi, '');

  const lines = text.split('\n');
  return lines.map((line) => {
    const stripped = line.trimEnd();
    const match = UG_SECTION_LINE_RE.exec(stripped);
    if (match && isSectionLabel(match[1])) {
      return `${match[1]}:`;
    }
    if (isChordLine(stripped)) {
      return wrapChordLine(stripped);
    }
    return stripped;
  });
}

/**
 * Format a raw UG tab response as an OnSong plain-text chord chart.
 */
export function formatOnSong(tab: RawTabData): string {
  const lines: string[] = [];

  // --- Header block ---
  lines.push(tab.song_name);
  lines.push(tab.artist_name);

  if (tab.tonality_name && tab.tonality_name.trim() !== '') {
    lines.push(`Key: ${tab.tonality_name}`);
  }

  if (tab.capo && tab.capo > 0) {
    lines.push(`Capo: ${tab.capo}`);
  }

  const tuning = (tab.tuning ?? '').trim();
  if (tuning !== '' && !STANDARD_TUNINGS.has(tuning)) {
    lines.push(`Tuning: ${tuning}`);
  }

  // Blank line after header
  lines.push('');

  // --- Content block ---
  const content = (tab.content ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const isStyleA = content.includes('[ch]');

  const contentLines = isStyleA ? processStyleA(content) : processStyleB(content);

  // Trim trailing whitespace from each content line
  const trimmed = contentLines.map((l) => l.trimEnd());

  // Collapse 3+ consecutive blank lines → 2
  const collapsed = collapseBlankLines(trimmed);

  lines.push(...collapsed);

  return lines.join('\n');
}
