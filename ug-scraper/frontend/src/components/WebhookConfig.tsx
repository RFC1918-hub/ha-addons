import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import { getWebhookConfig, saveWebhookConfig, testWebhook } from '../services/api';

interface WebhookConfigProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function WebhookConfig({ open, onClose, onSaved }: WebhookConfigProps) {
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await getWebhookConfig();
      if (config.configured) {
        setUrl(config.url || '');
        setEnabled(config.enabled || false);
      }
    } catch (err: any) {
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!url.trim()) {
      setError('Webhook URL is required');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }

    setLoading(true);
    try {
      // Auto-enable webhook when saving
      await saveWebhookConfig(url, true);
      setEnabled(true);
      setSuccess('Webhook configuration saved successfully!');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!url.trim()) {
      setError('Please enter a webhook URL first');
      return;
    }

    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      // First save the config
      await saveWebhookConfig(url, true);
      // Then test it
      await testWebhook();
      setSuccess('Test webhook sent successfully! Check your endpoint.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Test webhook failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Webhook Configuration</DialogTitle>
      <DialogContent>
        {loading && !testing ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TextField
              autoFocus
              margin="dense"
              label="Webhook URL"
              type="url"
              fullWidth
              variant="outlined"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://webhook.site/your-unique-id"
              helperText="Enter the URL where tabs will be sent"
              sx={{ mt: 2 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
              }
              label="Enable webhook"
              sx={{ mt: 2 }}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {success}
              </Alert>
            )}

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleTest}
                disabled={!url.trim() || testing || loading}
                fullWidth
              >
                {testing ? 'Testing...' : 'Test Webhook'}
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading || testing}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading || testing}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
