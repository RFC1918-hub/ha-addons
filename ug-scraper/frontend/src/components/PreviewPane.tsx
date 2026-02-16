import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
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
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { sendToWebhook } from '../services/api';
import type { Tab } from '../services/api';

interface PreviewPaneProps {
  tab: Tab | null;
  loading?: boolean;
  webhookConfigured: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
}

export default function PreviewPane({ tab, loading, webhookConfigured, onBack, showBackButton }: PreviewPaneProps) {
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleCopy = () => {
    if (tab) {
      navigator.clipboard.writeText(tab.onsong_format);
      setSnackbar({ open: true, message: 'Copied to clipboard!', severity: 'success' });
    }
  };

  const handleSend = async () => {
    if (!tab) return;

    setSending(true);
    try {
      await sendToWebhook({
        title: tab.title,
        artist: tab.artist,
        content: tab.onsong_format,
        key: tab.key || undefined,
        capo: tab.capo || undefined,
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!tab) {
    return (
      <Box sx={{ textAlign: 'center', p: 4, opacity: 0.5 }}>
        <Typography variant="body1" color="text.secondary">
          Select a tab to preview
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header bar with back button + song info */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 }, pb: 1 }}>
        {showBackButton && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            size="small"
            sx={{ mb: 1, color: 'text.secondary', textTransform: 'none' }}
          >
            Back to results
          </Button>
        )}

        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
          {tab.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {tab.artist}
        </Typography>

        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {tab.key && <Chip label={`Key: ${tab.key}`} size="small" color="primary" sx={{ height: 24, fontSize: '0.75rem' }} />}
          {tab.capo > 0 && <Chip label={`Capo: ${tab.capo}`} size="small" sx={{ height: 24, fontSize: '0.75rem' }} />}
          {tab.difficulty && <Chip label={tab.difficulty} size="small" sx={{ height: 24, fontSize: '0.75rem' }} />}
          {tab.chord_count > 0 && <Chip label={`${tab.chord_count} chords`} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} />}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
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

      {/* OnSong content */}
      <Paper
        elevation={0}
        sx={{
          flexGrow: 1,
          mx: { xs: 1, sm: 2 },
          mb: { xs: 1, sm: 2 },
          mt: 1,
          p: { xs: 1.5, sm: 2 },
          overflow: 'auto',
          bgcolor: 'rgba(0,0,0,0.3)',
          borderRadius: 2,
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
          {tab.onsong_format}
        </pre>
      </Paper>

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
