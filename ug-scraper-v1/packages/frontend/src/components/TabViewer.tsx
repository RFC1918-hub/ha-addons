import { Box } from '@mui/material';
import ChordChip from './ChordChip.js';
import SectionHeading from './SectionHeading.js';
import type { ContentNode } from '../services/api.js';

// Re-export for consumers that imported directly from here (backwards-compat)
export type { ContentNode } from '../services/api.js';

interface Props {
  content: ContentNode[];
}

export default function TabViewer({ content }: Props) {
  return (
    <Box>
      {content.map((node, i) => {
        if (node.type === 'heading') {
          return <SectionHeading key={i} text={node.text} />;
        }

        return (
          <Box
            key={i}
            component="p"
            sx={{
              margin: '0 0 2px',
              lineHeight: 1.8,
              fontFamily: '"Roboto Mono", "Consolas", "Menlo", monospace',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {node.tokens.map((token, j) => {
              if (token.type === 'chord') {
                return <ChordChip key={j} value={token.value} />;
              }
              if (token.type === 'tab-block') {
                return (
                  <Box
                    key={j}
                    component="pre"
                    sx={{
                      fontFamily: '"Roboto Mono", "Consolas", "Menlo", monospace',
                      fontSize: '0.82rem',
                      background: 'rgba(128,128,128,0.1)',
                      p: 1.5,
                      borderRadius: 1,
                      overflowX: 'auto',
                      my: 1,
                      whiteSpace: 'pre',
                    }}
                  >
                    {token.lines.join('\n')}
                  </Box>
                );
              }
              // text token
              return <span key={j}>{token.value}</span>;
            })}
          </Box>
        );
      })}
    </Box>
  );
}
