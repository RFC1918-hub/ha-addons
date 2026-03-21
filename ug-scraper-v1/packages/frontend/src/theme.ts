import { createTheme } from '@mui/material/styles';

/**
 * MUI v6 theme with Material 3-inspired tokens.
 *
 * Palette: deep amber primary (guitar-appropriate warmth), teal secondary
 * for section headings. Dark mode by default; light mode available when
 * the consumer passes mode='light'.
 *
 * The monospace font family is applied globally so chord content (pre, code,
 * .monospace) inherits it without needing local overrides.
 */
export function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#FFB300' : '#E65100', // Amber 700 / Deep Orange 900
      },
      secondary: {
        main: '#00BCD4', // Cyan 500 — readable on both dark and light backgrounds
      },
      background:
        mode === 'dark'
          ? { default: '#121212', paper: '#1E1E1E' }
          : { default: '#FAFAFA', paper: '#FFFFFF' },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      // Chord content is rendered in monospace; set a readable monospace stack
      fontFamilyMonospace: '"Roboto Mono", "Consolas", "Menlo", monospace',
    } as Record<string, unknown>,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          'pre, code': {
            fontFamily: '"Roboto Mono", "Consolas", "Menlo", monospace',
          },
        },
      },
    },
  });
}

// Default export: dark theme (system preference is handled in main.tsx)
export const theme = buildTheme('dark');
