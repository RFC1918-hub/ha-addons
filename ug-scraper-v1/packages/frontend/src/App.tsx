import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
} from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import SearchPage from './pages/SearchPage.js';
import TabPage from './pages/TabPage.js';

function NavBar() {
  const navigate = useNavigate();

  return (
    <AppBar position="sticky" color="default" elevation={1}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="home"
          onClick={() => navigate('/')}
          sx={{ mr: 1 }}
        >
          <MusicNoteIcon />
        </IconButton>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 700 }}
          onClick={() => navigate('/')}
        >
          Chord Finder
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

export default function App() {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <NavBar />
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/tab/:id" element={<TabPage />} />
      </Routes>
    </Box>
  );
}
