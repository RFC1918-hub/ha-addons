import { useNavigate } from 'react-router-dom';
import { Card, CardActionArea, CardContent, Typography, Box, Chip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';

interface TabSummary {
  id: number;
  song_name: string;
  artist_name: string;
  rating: number;
  votes: number;
  difficulty: string;
  capo: number;
  tuning: string;
  tonality_name: string;
}

interface Props {
  tab: TabSummary;
}

export default function ResultCard({ tab }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardActionArea onClick={() => navigate(`/tab/${tab.id}`)}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h6">{tab.song_name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {tab.artist_name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StarIcon fontSize="small" color="warning" />
              <Typography variant="body2">
                {tab.rating.toFixed(2)} ({tab.votes})
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {tab.difficulty && <Chip label={tab.difficulty} size="small" />}
            {tab.capo > 0 && <Chip label={`Capo ${tab.capo}`} size="small" />}
            {tab.tonality_name && <Chip label={`Key: ${tab.tonality_name}`} size="small" />}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
