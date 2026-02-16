import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Stack,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
} from '@mui/material';
import {
  Send as SendIcon,
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { sendToWebhook, formatManualContent } from '../services/api';

interface ManualEntryProps {
  webhookConfigured: boolean;
}

export default function ManualEntry({ webhookConfigured }: ManualEntryProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [content, setContent] = useState('');
  const [formatted, setFormatted] = useState('');
  const [sending, setSending] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const artistOrPlaceholder = artist.trim() || 'Unknown Artist';

  const handleFormat = async () => {
    if (!title.trim()) return;

    setFormatting(true);
    try {
      const result = await formatManualContent(title.trim(), artistOrPlaceholder, content);
      setFormatted(result);
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to format content',
        severity: 'error',
      });
    } finally {
      setFormatting(false);
    }
  };

  const handleCopy = () => {
    if (formatted) {
      navigator.clipboard.writeText(formatted);
      setSnackbar({ open: true, message: 'Copied to clipboard!', severity: 'success' });
    }
  };

  const handleSend = async () => {
    if (!formatted) return;

    setSending(true);
    try {
      await sendToWebhook({
        title: title.trim(),
        artist: artistOrPlaceholder,
        content: formatted,
      });
      setSnackbar({ open: true, message: 'Sent to webhook!', severity: 'success' });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to send webhook',
        severity: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Input section */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1 }}>
        <Stack spacing={1.5}>
          <TextField
            label="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
            fullWidth
            placeholder="Song title"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          />
          <TextField
            label="Artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            size="small"
            fullWidth
            placeholder="Unknown Artist"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          />
          <TextField
            label="Chord Sheet / Lyrics"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            minRows={6}
            maxRows={12}
            fullWidth
            placeholder={'Paste or type your chord sheet here...\n\n[Verse 1]\n      G        C\nAmazing grace how sweet\n      G\nThe sound...'}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
                fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace',
                fontSize: '0.85rem',
              },
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={formatting ? <CircularProgress size={16} /> : <PreviewIcon />}
              onClick={handleFormat}
              disabled={!title.trim() || formatting}
              size="small"
              sx={{ textTransform: 'none', flex: 1 }}
            >
              {formatting ? 'Formatting...' : 'Format Preview'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Formatted preview */}
      {formatted && (
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', px: { xs: 1, sm: 2 }, pb: { xs: 1, sm: 2 } }}>
          <Box sx={{ px: 1, py: 0.5 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={handleCopy}
                size="small"
                sx={{ textTransform: 'none', flex: 1 }}
              >
                Copy OnSong
              </Button>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={handleSend}
                disabled={!webhookConfigured || sending}
                size="small"
                sx={{ textTransform: 'none', flex: 1 }}
              >
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </Stack>
          </Box>

          <Paper
            elevation={0}
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              bgcolor: 'rgba(0,0,0,0.3)',
              borderRadius: 2,
              p: { xs: 1.5, sm: 2 },
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <pre
              style={{
                fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace',
                fontSize: '0.82rem',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                margin: 0,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              {formatted}
            </pre>
          </Paper>
        </Box>
      )}

      {!formatted && (
        <Box sx={{ textAlign: 'center', p: 4, opacity: 0.5, flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Enter song details and click Format Preview
          </Typography>
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
          action={
            <IconButton size="small" color="inherit" onClick={() => setSnackbar({ ...snackbar, open: false })}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
