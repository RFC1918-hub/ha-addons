import { useState } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PreviewIcon from '@mui/icons-material/Preview';
import { formatManual, sendToOnSong, getOnSongConfig } from '../services/api.js';
import type { ContentNode } from '../services/api.js';
import TabViewer from '../components/TabViewer.js';

export default function ManualPage() {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [content, setContent] = useState('');
  const [formatted, setFormatted] = useState<{
    title: string;
    artist: string;
    content: ContentNode[];
    onsong: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onsongConfigured, setOnsongConfigured] = useState<boolean | null>(null);

  async function handleFormat() {
    if (!title.trim() || !artist.trim() || !content.trim()) {
      setError('Title, artist, and content are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await formatManual(title.trim(), artist.trim(), content);
      setFormatted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Formatting failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!formatted) return;

    setSending(true);
    setError(null);

    try {
      await sendToOnSong(formatted.title, formatted.artist, formatted.onsong);
      setError('Successfully sent to OnSong!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to OnSong');
    } finally {
      setSending(false);
    }
  }

  async function checkOnSongConfig() {
    if (onsongConfigured === null) {
      try {
        const config = await getOnSongConfig();
        setOnsongConfigured(config.configured);
      } catch {
        setOnsongConfigured(false);
      }
    }
  }

  // Check config on mount
  useState(() => {
    checkOnSongConfig();
  });

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Manual Chord Submission
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Paste your chord chart below. Use [ch]chord[/ch] for chords or plain text with chords above lyrics.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <TextField
          label="Song Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Chord Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          multiline
          rows={10}
          fullWidth
          placeholder="Paste your chords here..."
        />
        <Button
          variant="contained"
          onClick={handleFormat}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <PreviewIcon />}
        >
          {loading ? 'Formatting...' : 'Format & Preview'}
        </Button>
      </Box>

      {error && (
        <Alert severity={error === 'Successfully sent to OnSong!' ? 'success' : 'error'} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {formatted && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Preview
          </Typography>
          <TabViewer content={formatted.content} />
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            OnSong Format
          </Typography>
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem' }}>
            {formatted.onsong}
          </Box>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={sending || onsongConfigured === false}
              startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
            >
              {sending ? 'Sending...' : 'Send to OnSong'}
            </Button>
            {onsongConfigured === false && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                OnSong not configured. Please set the ONSONG_TOKEN in the add-on options.
              </Typography>
            )}
          </Box>
        </Paper>
      )}
    </Container>
  );
}