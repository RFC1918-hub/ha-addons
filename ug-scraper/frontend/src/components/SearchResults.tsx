import {
  Typography,
  Chip,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Rating,
} from '@mui/material';
import { MusicNote as MusicNoteIcon } from '@mui/icons-material';
import type { SearchResult } from '../services/api';

interface SearchResultsProps {
  results: SearchResult[];
  onSelect: (id: string) => void;
  selectedId?: string;
}

export default function SearchResults({ results, onSelect, selectedId }: SearchResultsProps) {
  if (!results || results.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: { xs: 4, sm: 8 }, px: 2 }}>
        <MusicNoteIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.4 }} />
        <Typography variant="body1" color="text.secondary">
          Search for a song or artist
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding sx={{ px: { xs: 0, sm: 1 } }}>
      {results.map((result) => (
        <ListItemButton
          key={result.id}
          selected={selectedId === result.id}
          onClick={() => onSelect(result.id)}
          sx={{
            borderRadius: { xs: 0, sm: 2 },
            mb: 0.5,
            py: 1.5,
            px: 2,
            '&.Mui-selected': {
              bgcolor: 'rgba(144, 202, 249, 0.12)',
              borderLeft: '3px solid',
              borderColor: 'primary.main',
            },
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.04)',
            },
          }}
        >
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body1" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                  {result.title}
                </Typography>
                {result.type && (
                  <Chip
                    label={result.type}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      bgcolor: 'rgba(144, 202, 249, 0.15)',
                      color: 'primary.main',
                    }}
                  />
                )}
              </Box>
            }
            secondary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                <Typography variant="body2" color="text.secondary" component="span">
                  {result.artist || 'Unknown artist'}
                </Typography>
                {result.rating > 0 && (
                  <Rating value={result.rating} precision={0.1} size="small" readOnly
                    sx={{ ml: 'auto', '& .MuiRating-icon': { fontSize: '0.9rem' } }}
                  />
                )}
              </Box>
            }
            primaryTypographyProps={{ component: 'div' }}
            secondaryTypographyProps={{ component: 'div' }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
