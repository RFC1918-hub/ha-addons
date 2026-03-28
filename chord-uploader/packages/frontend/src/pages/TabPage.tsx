import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Alert,
  Button,
  Chip,
  Skeleton,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { fetchTab, getOnSongConfig, sendToOnSong } from '../services/api.js';
import type { TabDetail } from '../services/api.js';

export default function TabPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OnSong edit state
  const [onsongText, setOnsongText] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState('');

  // OnSong Cloud state
  const [onsongConfigured, setOnsongConfigured] = useState(false);
  const [sending, setSending] = useState(false);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setTab(null);
    setEditMode(false);

    fetchTab(Number(id))
      .then(({ tab: t }) => {
        setTab(t);
        setOnsongText(t.onsong);
        setEditDraft(t.onsong);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load tab')
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch OnSong Cloud configuration on mount
  useEffect(() => {
    getOnSongConfig()
      .then(({ configured }) => setOnsongConfigured(configured))
      .catch(() => setOnsongConfigured(false));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(onsongText).then(() => {
      showSnackbar('Copied to clipboard');
    });
  };

  const handleEditStart = () => {
    setEditDraft(onsongText);
    setEditMode(true);
  };

  const handleEditDone = () => {
    setOnsongText(editDraft);
    setEditMode(false);
  };

  const handleEditReset = () => {
    if (!tab) return;
    setEditDraft(tab.onsong);
    setOnsongText(tab.onsong);
    setEditMode(false);
  };

  const handleSendToOnSong = async () => {
    if (!tab) return;
    setSending(true);
    try {
      const { filename } = await sendToOnSong(tab.song_name, tab.artist_name, onsongText);
      showSnackbar(`Sent to OnSong: ${filename}`);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

      {loading && (
        <Box>
          <Skeleton variant="text" width="60%" height={40} />
          <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={200} />
        </Box>
      )}

      {error && (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="outlined" onClick={load}>
            Retry
          </Button>
        </Box>
      )}

      {tab && (
        <>
          <Typography variant="h5" component="h1" gutterBottom>
            {tab.song_name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {tab.artist_name}
          </Typography>

          {/* Metadata row */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              mb: 3,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StarIcon fontSize="small" color="warning" />
              <Typography variant="body2">
                {tab.rating.toFixed(2)} ({tab.votes} votes)
              </Typography>
            </Box>
            {tab.difficulty && (
              <Chip label={tab.difficulty} size="small" variant="outlined" />
            )}
            {tab.capo > 0 && (
              <Chip label={`Capo ${tab.capo}`} size="small" variant="outlined" />
            )}
            {tab.tonality_name && (
              <Chip label={`Key: ${tab.tonality_name}`} size="small" variant="outlined" />
            )}
            {tab.tuning && (
              <Chip label={`Tuning: ${tab.tuning}`} size="small" variant="outlined" />
            )}
          </Box>

          {/* Toolbar row */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 1 }}>
            {editMode ? (
              <>
                <Button size="small" variant="contained" onClick={handleEditDone}>Done</Button>
                <Button size="small" variant="outlined" color="warning" onClick={handleEditReset}>Reset</Button>
              </>
            ) : (
              <>
                <Tooltip title={onsongConfigured ? 'Send to OnSong Cloud' : 'Set ONSONG_TOKEN to enable'}>
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <CloudUploadIcon fontSize="small" />}
                      onClick={() => void handleSendToOnSong()}
                      disabled={!onsongConfigured || sending}
                    >
                      Send to OnSong
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Copy to clipboard">
                  <IconButton onClick={handleCopy} size="small" aria-label="Copy OnSong text">
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton onClick={handleEditStart} size="small" aria-label="Edit OnSong text">
                    <EditNoteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>

          {/* OnSong content */}
          {editMode ? (
            <TextField
              multiline
              fullWidth
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              inputProps={{ style: { fontFamily: '"Roboto Mono", "Consolas", monospace', fontSize: '0.85rem' } }}
              sx={{ '& .MuiInputBase-root': { alignItems: 'flex-start' } }}
            />
          ) : (
            <Box
              component="pre"
              sx={{
                fontFamily: '"Roboto Mono", "Consolas", monospace',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                m: 0,
                overflowX: 'auto',
              }}
            >
              {onsongText}
            </Box>
          )}
        </>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2500}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}
