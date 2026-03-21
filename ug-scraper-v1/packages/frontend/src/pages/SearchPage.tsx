import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  CircularProgress,
  Alert,
  Typography,
  Collapse,
  TextField,
  Button,
  Divider,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import SearchBar from '../components/SearchBar.js';
import ResultCard from '../components/ResultCard.js';
import { searchTabs, resolveUrl } from '../services/api.js';
import type { TabSummary } from '../services/api.js';

export default function SearchPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<TabSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // URL paste state
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  async function handleSearch(q: string, artist?: string) {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await searchTabs(q, artist);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUrlResolve() {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    setUrlError(null);

    try {
      const { id } = await resolveUrl(urlInput.trim());
      navigate(`/tab/${id}`);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Could not extract tab ID from URL');
    } finally {
      setUrlLoading(false);
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SearchBar onSearch={handleSearch} />

      {/* URL paste toggle */}
      <Box sx={{ mt: 2 }}>
        <Button
          size="small"
          startIcon={<LinkIcon />}
          onClick={() => setShowUrlInput(!showUrlInput)}
          color="secondary"
        >
          {showUrlInput ? 'Hide URL input' : 'Paste a tab URL instead'}
        </Button>
        <Collapse in={showUrlInput}>
          <Box
            sx={{
              mt: 1,
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <TextField
              label="Ultimate Guitar tab URL"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleUrlResolve();
              }}
              size="small"
              sx={{ flex: '1 1 300px' }}
              placeholder="https://www.ultimate-guitar.com/tab/..."
              error={!!urlError}
              helperText={urlError ?? undefined}
            />
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => void handleUrlResolve()}
              disabled={urlLoading || !urlInput.trim()}
              size="small"
            >
              {urlLoading ? <CircularProgress size={16} /> : 'Open tab'}
            </Button>
          </Box>
        </Collapse>
      </Box>

      <Divider sx={{ mt: 3 }} />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && hasSearched && results.length === 0 && !error && (
        <Typography color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          No chord tabs found. Try a different search or paste a tab URL above.
        </Typography>
      )}

      {!loading && results.length > 0 && (
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {results.map((tab) => (
            <ResultCard key={tab.id} tab={tab} />
          ))}
        </Box>
      )}
    </Container>
  );
}
