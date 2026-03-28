import { parseContent } from '../src/services/content-parser.js';

describe('parseContent', () => {
  describe('headings', () => {
    it('parses a standalone bracketed label as a heading node', () => {
      const result = parseContent('[Verse 1]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'heading', text: 'Verse 1' });
    });

    it('parses multiple heading types', () => {
      const input = '[Chorus]\n[Bridge]\n[Outro]';
      const result = parseContent(input);
      expect(result).toHaveLength(3);
      expect(result.map((n) => (n.type === 'heading' ? n.text : ''))).toEqual([
        'Chorus',
        'Bridge',
        'Outro',
      ]);
    });
  });

  describe('chord tokens', () => {
    it('parses [ch]Am[/ch] into a chord token', () => {
      const result = parseContent('[ch]Am[/ch]');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('paragraph');
      if (result[0].type === 'paragraph') {
        expect(result[0].tokens).toHaveLength(1);
        expect(result[0].tokens[0]).toEqual({ type: 'chord', value: 'Am' });
      }
    });

    it('interleaves text and chord tokens correctly', () => {
      const result = parseContent('Play [ch]G[/ch] then [ch]Em[/ch] slowly');
      expect(result).toHaveLength(1);
      if (result[0].type === 'paragraph') {
        const { tokens } = result[0];
        expect(tokens[0]).toEqual({ type: 'text', value: 'Play ' });
        expect(tokens[1]).toEqual({ type: 'chord', value: 'G' });
        expect(tokens[2]).toEqual({ type: 'text', value: ' then ' });
        expect(tokens[3]).toEqual({ type: 'chord', value: 'Em' });
        expect(tokens[4]).toEqual({ type: 'text', value: ' slowly' });
      }
    });

    it('handles chord at start of line with trailing text', () => {
      const result = parseContent('[ch]C[/ch]  G  Am  F');
      if (result[0].type === 'paragraph') {
        expect(result[0].tokens[0]).toEqual({ type: 'chord', value: 'C' });
        expect(result[0].tokens[1]).toEqual({ type: 'text', value: '  G  Am  F' });
      }
    });
  });

  describe('tab blocks', () => {
    it('parses [tab]...[/tab] as a tab-block token inside a paragraph', () => {
      const input = '[tab]e|---0---|\nB|---1---|[/tab]';
      const result = parseContent(input);
      expect(result).toHaveLength(1);
      if (result[0].type === 'paragraph') {
        expect(result[0].tokens).toHaveLength(1);
        const tok = result[0].tokens[0];
        expect(tok.type).toBe('tab-block');
        if (tok.type === 'tab-block') {
          expect(tok.lines).toEqual(['e|---0---|', 'B|---1---|']);
        }
      }
    });

    it('strips empty leading and trailing lines from tab blocks', () => {
      const input = '[tab]\n\ne|---0---|\nB|---1---|\n\n[/tab]';
      const result = parseContent(input);
      if (result[0].type === 'paragraph') {
        const tok = result[0].tokens[0];
        if (tok.type === 'tab-block') {
          expect(tok.lines[0]).toBe('e|---0---|');
          expect(tok.lines[tok.lines.length - 1]).toBe('B|---1---|');
        }
      }
    });

    it('[tab] block containing [ch] tags is processed as lyric/chord content, not a tab-block', () => {
      // This is the "Gratitude" pattern: UG wraps chord/lyric lines in [tab]
      const input = '[tab][ch]B[/ch]         [ch]E[/ch]\nGratitude[/tab]';
      const result = parseContent(input);
      // Should produce two paragraph nodes, neither being a tab-block
      const types = result.map((n) => n.type);
      expect(types).not.toContain('tab-block');
      // The chord line must contain chord tokens
      const chordPara = result.find(
        (n) => n.type === 'paragraph' && n.tokens.some((t) => t.type === 'chord')
      );
      expect(chordPara).toBeDefined();
      if (chordPara && chordPara.type === 'paragraph') {
        const chords = chordPara.tokens.filter((t) => t.type === 'chord');
        expect(chords).toEqual([
          { type: 'chord', value: 'B' },
          { type: 'chord', value: 'E' },
        ]);
      }
    });

    it('[tab] block with [ch] tags does not produce any raw [ch] text tokens', () => {
      const input = '[tab][ch]Am[/ch] some lyrics[/tab]';
      const result = parseContent(input);
      for (const node of result) {
        if (node.type === 'paragraph') {
          for (const tok of node.tokens) {
            if (tok.type === 'text') {
              expect(tok.value).not.toContain('[ch]');
              expect(tok.value).not.toContain('[/ch]');
            }
          }
        }
      }
    });

    it('[tab] block with guitar tab lines (e|, B|, etc.) produces a tab-block token', () => {
      const input = '[tab]e|--0--2--|\nB|--1--3--|\nG|--0--2--|[/tab]';
      const result = parseContent(input);
      expect(result).toHaveLength(1);
      if (result[0].type === 'paragraph') {
        expect(result[0].tokens[0].type).toBe('tab-block');
      }
    });

    it('[tab] block without [ch] tags and without guitar-tab lines is processed as plain text', () => {
      const input = '[tab]Some plain text here[/tab]';
      const result = parseContent(input);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('paragraph');
      if (result[0].type === 'paragraph') {
        // No tab-block token
        expect(result[0].tokens[0].type).not.toBe('tab-block');
      }
    });
  });

  describe('mixed content', () => {
    it('handles a full verse block with headings, chords and lyrics', () => {
      const input = [
        '[Verse 1]',
        '[ch]Am[/ch]         [ch]G[/ch]',
        'There is a house in New Orleans',
      ].join('\n');

      const result = parseContent(input);
      expect(result[0]).toEqual({ type: 'heading', text: 'Verse 1' });
      expect(result[1].type).toBe('paragraph');
      expect(result[2].type).toBe('paragraph');
    });

    it('skips blank lines', () => {
      const input = '[Intro]\n\n[ch]Em[/ch]\n\n';
      const result = parseContent(input);
      expect(result).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(parseContent('')).toHaveLength(0);
    });

    it('returns empty array for whitespace-only input', () => {
      expect(parseContent('   \n   \n   ')).toHaveLength(0);
    });

    it('normalises Windows line endings', () => {
      const result = parseContent('[Intro]\r\n[ch]Am[/ch]');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'heading', text: 'Intro' });
    });
  });
});
