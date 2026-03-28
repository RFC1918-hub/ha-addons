/**
 * UG proprietary markup parser.
 * Converts raw content string into ContentNode[].
 *
 * Markup rules (from ADR):
 *   [ch]Am[/ch]          → { type: 'chord', value: 'Am' }
 *   [tab]...[/tab]        → { type: 'tab-block', lines: [...] }
 *   [Verse 1], [Chorus]   → { type: 'heading', text: 'Verse 1' }
 *   remaining text        → { type: 'text', value: '...' }
 */

export type Token =
  | { type: 'text'; value: string }
  | { type: 'chord'; value: string }
  | { type: 'tab-block'; lines: string[] };

export type ContentNode =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; tokens: Token[] };

export function parseContent(raw: string): ContentNode[] {
  const nodes: ContentNode[] = [];

  // Normalise line endings
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on [tab]...[/tab] blocks first to handle multi-line tab sections
  const TAB_BLOCK_RE = /\[tab\]([\s\S]*?)\[\/tab\]/gi;
  const HEADING_RE = /^\[([^\]]+)\]\s*$/;

  // Process line by line, tracking tab blocks
  const segments = text.split(TAB_BLOCK_RE);

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 1) {
      // This is a tab block body (captured group from split).
      // Determine how to treat it:
      //   1. Contains [ch] tags → lyric/chord content wrapped in [tab] for layout
      //      reasons. Strip the wrapper and process line-by-line as normal content.
      //   2. No [ch] tags but contains guitar tab lines (e|---, B|--- etc.)
      //      → genuine tab-block token.
      //   3. Otherwise → process as regular text lines.
      const inner = segments[i];
      if (/\[ch\]/i.test(inner)) {
        // Process inner content line by line through the normal parser path
        const innerLines = inner.split('\n');
        for (const line of innerLines) {
          const stripped = line.trim();
          if (stripped === '') continue;
          const headingMatch = HEADING_RE.exec(stripped);
          if (headingMatch) {
            nodes.push({ type: 'heading', text: headingMatch[1] });
            continue;
          }
          const tokens = parseInlineTokens(line);
          if (tokens.length > 0) {
            nodes.push({ type: 'paragraph', tokens });
          }
        }
      } else if (/^[eBGDAE]\|/m.test(inner)) {
        // Genuine guitar tablature block
        const lines = inner.split('\n').map((l) => l.trimEnd());
        // Drop empty leading/trailing lines
        while (lines.length > 0 && lines[0].trim() === '') lines.shift();
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
        nodes.push({ type: 'paragraph', tokens: [{ type: 'tab-block', lines }] });
      } else {
        // Plain text wrapped in [tab] for layout — process line by line
        const innerLines = inner.split('\n');
        for (const line of innerLines) {
          const stripped = line.trim();
          if (stripped === '') continue;
          const headingMatch = HEADING_RE.exec(stripped);
          if (headingMatch) {
            nodes.push({ type: 'heading', text: headingMatch[1] });
            continue;
          }
          const tokens = parseInlineTokens(line);
          if (tokens.length > 0) {
            nodes.push({ type: 'paragraph', tokens });
          }
        }
      }
    } else {
      // Regular text segment — process line by line
      const lines = segments[i].split('\n');
      for (const line of lines) {
        const stripped = line.trim();
        if (stripped === '') continue;

        // Heading?
        const headingMatch = HEADING_RE.exec(stripped);
        if (headingMatch) {
          nodes.push({ type: 'heading', text: headingMatch[1] });
          continue;
        }

        // Parse inline chord tokens
        const tokens = parseInlineTokens(line);
        if (tokens.length > 0) {
          nodes.push({ type: 'paragraph', tokens });
        }
      }
    }
  }

  return nodes;
}

/**
 * Parse a line of text containing optional [ch]...[/ch] chord markers.
 */
function parseInlineTokens(line: string): Token[] {
  const tokens: Token[] = [];
  const CHORD_RE = /\[ch\](.*?)\[\/ch\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CHORD_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const textValue = line.slice(lastIndex, match.index);
      if (textValue) tokens.push({ type: 'text', value: textValue });
    }
    tokens.push({ type: 'chord', value: match[1] });
    lastIndex = CHORD_RE.lastIndex;
  }

  if (lastIndex < line.length) {
    const remaining = line.slice(lastIndex);
    if (remaining) tokens.push({ type: 'text', value: remaining });
  }

  return tokens;
}
