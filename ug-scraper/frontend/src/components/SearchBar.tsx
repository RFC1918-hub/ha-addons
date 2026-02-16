import { useState, useEffect } from 'react';
import { TextField, InputAdornment, CircularProgress, Box } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');

  // Debounce search
  useEffect(() => {
    if (!query.trim()) return;

    const timer = setTimeout(() => {
      onSearch(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <Box sx={{ width: '100%', px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 }, maxWidth: 700, mx: 'auto' }}>
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search songs or artists..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="medium"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: loading ? (
            <InputAdornment position="end">
              <CircularProgress size={20} />
            </InputAdornment>
          ) : null,
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 3,
            bgcolor: 'background.paper',
          },
        }}
      />
    </Box>
  );
}
