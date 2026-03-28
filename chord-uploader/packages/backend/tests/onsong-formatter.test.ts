import { formatOnSong } from '../src/services/onsong-formatter.js';
import type { RawTabData } from '../src/services/onsong-formatter.js';

/** Build a minimal RawTabData with sensible defaults. */
function makeTab(overrides: Partial<RawTabData> = {}): RawTabData {
  return {
    id: 1,
    song_name: 'Test Song',
    artist_name: 'Test Artist',
    type: 'Chords',
    rating: 4.5,
    votes: 100,
    difficulty: 'intermediate',
    capo: 0,
    tuning: '',
    tonality_name: '',
    content: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Header generation
// ---------------------------------------------------------------------------

describe('formatOnSong — header', () => {
  it('always outputs song_name on line 1 and artist_name on line 2', () => {
    const output = formatOnSong(makeTab({ song_name: 'Wonderwall', artist_name: 'Oasis' }));
    const lines = output.split('\n');
    expect(lines[0]).toBe('Wonderwall');
    expect(lines[1]).toBe('Oasis');
  });

  it('includes Key line when tonality_name is non-empty', () => {
    const output = formatOnSong(makeTab({ tonality_name: 'F#m' }));
    expect(output).toContain('Key: F#m');
  });

  it('omits Key line when tonality_name is empty', () => {
    const output = formatOnSong(makeTab({ tonality_name: '' }));
    expect(output).not.toMatch(/^Key:/m);
  });

  it('includes Capo line when capo > 0', () => {
    const output = formatOnSong(makeTab({ capo: 2 }));
    expect(output).toContain('Capo: 2');
  });

  it('omits Capo line when capo is 0', () => {
    const output = formatOnSong(makeTab({ capo: 0 }));
    expect(output).not.toMatch(/^Capo:/m);
  });

  it('includes Tuning line when tuning is non-standard and non-empty', () => {
    const output = formatOnSong(makeTab({ tuning: 'D A D G B E' }));
    expect(output).toContain('Tuning: D A D G B E');
  });

  it('omits Tuning line when tuning is standard (E A D G B E)', () => {
    const output = formatOnSong(makeTab({ tuning: 'E A D G B E' }));
    expect(output).not.toMatch(/^Tuning:/m);
  });

  it('omits Tuning line when tuning is empty string', () => {
    const output = formatOnSong(makeTab({ tuning: '' }));
    expect(output).not.toMatch(/^Tuning:/m);
  });

  it('outputs a blank line after the header block', () => {
    // header = song + artist + key → 3 lines, then blank, then content
    const output = formatOnSong(makeTab({ song_name: 'A', artist_name: 'B', tonality_name: 'Am', content: 'Hello' }));
    const lines = output.split('\n');
    // Line 0: A, Line 1: B, Line 2: Key: Am, Line 3: blank
    expect(lines[3]).toBe('');
  });

  it('produces correct header for Wonderwall with all fields', () => {
    const tab = makeTab({
      song_name: 'Wonderwall',
      artist_name: 'Oasis',
      tonality_name: 'F#m',
      capo: 2,
      tuning: 'EADGBe',
    });
    const output = formatOnSong(tab);
    const lines = output.split('\n');
    expect(lines[0]).toBe('Wonderwall');
    expect(lines[1]).toBe('Oasis');
    expect(lines[2]).toBe('Key: F#m');
    expect(lines[3]).toBe('Capo: 2');
    expect(lines[4]).toBe('');
    expect(output).not.toMatch(/^Tuning:/m); // EADGBe is standard, suppressed
  });
});

// ---------------------------------------------------------------------------
// Style A — inline [ch] tags
// ---------------------------------------------------------------------------

describe('formatOnSong — Style A (inline [ch] tags)', () => {
  it('converts [ch]Am[/ch] to [Am]', () => {
    const output = formatOnSong(makeTab({ content: '[ch]Am[/ch]' }));
    expect(output).toContain('[Am]');
    expect(output).not.toContain('[ch]');
  });

  it('converts inline [ch] chords mixed with lyrics', () => {
    const content = 'Today is [ch]G[/ch] gonna be the day';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('Today is [G] gonna be the day');
  });

  it('converts multiple chords on one line', () => {
    const content = '[ch]Em7[/ch]  [ch]G[/ch]  [ch]Dsus4[/ch]  [ch]A7sus4[/ch]';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('[Em7]  [G]  [Dsus4]  [A7sus4]');
  });

  it('converts [Verse 1] standalone line to "Verse 1:"', () => {
    const content = '[Verse 1]\n[ch]Am[/ch] lyrics';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('Verse 1:');
    expect(output).not.toContain('[Verse 1]');
  });

  it('converts [Chorus] standalone line to "Chorus:"', () => {
    const content = '[Chorus]\n[ch]G[/ch] words';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('Chorus:');
  });

  it('converts [Bridge] standalone line to "Bridge:"', () => {
    const output = formatOnSong(makeTab({ content: '[Bridge]' }));
    expect(output).toContain('Bridge:');
  });

  it('converts [Pre-Chorus] standalone line to "Pre-Chorus:"', () => {
    const output = formatOnSong(makeTab({ content: '[Pre-Chorus]' }));
    expect(output).toContain('Pre-Chorus:');
  });

  it('strips [tab] and [/tab] wrapper tags but keeps inner content', () => {
    const content = '[tab]e|---0---|\nB|---1---|[/tab]';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('e|---0---|');
    expect(output).toContain('B|---1---|');
    expect(output).not.toContain('[tab]');
    expect(output).not.toContain('[/tab]');
  });

  it('does not convert non-section bracketed text to a section label', () => {
    // A chord name in brackets after [ch] conversion is not a section label
    const content = '[ch]C[/ch]';
    const output = formatOnSong(makeTab({ content }));
    // [C] should remain as a chord, not become "C:"
    expect(output).toContain('[C]');
    expect(output).not.toContain('C:');
  });
});

// ---------------------------------------------------------------------------
// Style B — bare chord lines (no [ch] tags)
// ---------------------------------------------------------------------------

describe('formatOnSong — Style B (bare chord lines)', () => {
  it('wraps a bare chord line: "Em7 G" → "[Em7] [G]"', () => {
    const content = 'Em7 G';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('[Em7] [G]');
  });

  it('wraps a multi-chord line preserving spacing', () => {
    // Note: the spec chord regex does not match "A7sus4" (number before sus),
    // so we use only regex-valid tokens in this spacing test.
    const content = 'Em7     G       Dsus4   Am';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('[Em7]     [G]       [Dsus4]   [Am]');
  });

  it('leaves lyric lines unchanged', () => {
    const content = 'Em7 G\nToday is gonna be the day';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('Today is gonna be the day');
  });

  it('converts [Verse 1] standalone line to "Verse 1:" in Style B', () => {
    const content = '[Verse 1]\nEm7 G\nSome lyrics here';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('Verse 1:');
    expect(output).toContain('[Em7] [G]');
    expect(output).toContain('Some lyrics here');
  });

  it('handles single chord on its own line', () => {
    const output = formatOnSong(makeTab({ content: 'Am' }));
    expect(output).toContain('[Am]');
  });

  it('handles slash chords: "C/G" → "[C/G]"', () => {
    const output = formatOnSong(makeTab({ content: 'C/G Am F G' }));
    expect(output).toContain('[C/G]');
    expect(output).toContain('[Am]');
  });

  it('handles chord extensions: "Fmaj7 Asus4 Bdim" → wrapped correctly', () => {
    const output = formatOnSong(makeTab({ content: 'Fmaj7 Asus4 Bdim' }));
    expect(output).toContain('[Fmaj7]');
    expect(output).toContain('[Asus4]');
    expect(output).toContain('[Bdim]');
  });

  it('does not wrap a lyric line that starts with a chord-like word', () => {
    // "Am I right?" — "Am" passes chord check but "I" and "right?" do not
    const output = formatOnSong(makeTab({ content: 'Am I right?' }));
    // "I" and "right?" are not chords, so the whole line is a lyric
    expect(output).toContain('Am I right?');
    expect(output).not.toContain('[Am]');
  });

  it('strips [tab] and [/tab] wrappers in Style B', () => {
    const content = '[tab]e|---0---|\nB|---1---|[/tab]';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('e|---0---|');
    expect(output).not.toContain('[tab]');
  });
});

// ---------------------------------------------------------------------------
// Section label conversion
// ---------------------------------------------------------------------------

describe('formatOnSong — section labels', () => {
  it('converts all known section keywords (case variants)', () => {
    const labels = ['Verse', 'Chorus', 'Bridge', 'Intro', 'Outro', 'Solo', 'Break', 'Tag', 'Hook', 'Coda'];
    for (const label of labels) {
      const output = formatOnSong(makeTab({ content: `[${label}]` }));
      expect(output).toContain(`${label}:`);
    }
  });

  it('converts numbered sections like [Verse 2]', () => {
    const output = formatOnSong(makeTab({ content: '[Verse 2]\n[ch]G[/ch]' }));
    expect(output).toContain('Verse 2:');
  });

  it('does not convert a mid-line bracketed label to a section heading', () => {
    // Style A: a bracketed chord like "[G]" in the middle of a line should not become "G:"
    const content = 'Start [ch]G[/ch] end';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('[G]');
    expect(output).not.toContain('G:');
  });
});

// ---------------------------------------------------------------------------
// Blank line collapsing
// ---------------------------------------------------------------------------

describe('formatOnSong — blank line collapsing', () => {
  it('collapses 3 consecutive blank lines to 2', () => {
    const content = 'Line A\n\n\n\nLine B';
    const output = formatOnSong(makeTab({ content }));
    // Should not have 3+ consecutive blank lines in the content portion
    expect(output).not.toMatch(/\n{4,}/);
  });

  it('preserves 1 blank line between sections', () => {
    const content = 'Line A\n\nLine B';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('Line A\n\nLine B');
  });
});

// ---------------------------------------------------------------------------
// Windows line ending normalisation
// ---------------------------------------------------------------------------

describe('formatOnSong — line endings', () => {
  it('normalises CRLF in content', () => {
    const content = '[Verse 1]\r\n[ch]Am[/ch]';
    const output = formatOnSong(makeTab({ content }));
    expect(output).toContain('Verse 1:');
    expect(output).toContain('[Am]');
  });
});

// ---------------------------------------------------------------------------
// Full integration snapshot — Wonderwall-like input
// ---------------------------------------------------------------------------

describe('formatOnSong — full integration', () => {
  it('produces correct OnSong for a Style A Wonderwall-like input', () => {
    const tab = makeTab({
      song_name: 'Wonderwall',
      artist_name: 'Oasis',
      tonality_name: 'F#m',
      capo: 2,
      tuning: 'EADGBe',
      content: [
        '[Intro]',
        '[ch]Em7[/ch]  [ch]G[/ch]  [ch]Dsus4[/ch]  [ch]A7sus4[/ch]',
        '',
        '[Verse 1]',
        "Today is gonna be the day that they're gonna throw it back to you",
        '[ch]Em7[/ch] [ch]G[/ch]',
        'By now you should have somehow',
      ].join('\n'),
    });

    const output = formatOnSong(tab);
    const lines = output.split('\n');

    expect(lines[0]).toBe('Wonderwall');
    expect(lines[1]).toBe('Oasis');
    expect(lines[2]).toBe('Key: F#m');
    expect(lines[3]).toBe('Capo: 2');
    expect(lines[4]).toBe('');
    expect(output).not.toMatch(/^Tuning:/m); // EADGBe is standard, suppressed
    expect(output).toContain('Intro:');
    expect(output).toContain('[Em7]  [G]  [Dsus4]  [A7sus4]');
    expect(output).toContain('Verse 1:');
    expect(output).toContain("Today is gonna be the day");
    expect(output).toContain('[Em7] [G]');
    expect(output).not.toContain('[ch]');
    expect(output).not.toContain('[/ch]');
  });
});
