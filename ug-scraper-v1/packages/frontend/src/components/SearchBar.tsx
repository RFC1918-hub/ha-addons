import { useState } from 'react';
import { Box, TextField, Button } from '@mui/material';

interface Props {
  onSearch: (q: string, artist?: string) => void;
}

export default function SearchBar({ onSearch }: Props) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSearch(title.trim(), artist.trim() || undefined);
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}
    >
      <TextField
        label="Song title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        sx={{ flex: '1 1 200px' }}
      />
      <TextField
        label="Artist (optional)"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        sx={{ flex: '1 1 200px' }}
      />
      <Button type="submit" variant="contained" size="large">
        Search
      </Button>
    </Box>
  );
}
