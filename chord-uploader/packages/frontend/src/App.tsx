import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import SearchPage from './pages/SearchPage.js';
import TabPage from './pages/TabPage.js';
import ManualPage from './pages/ManualPage.js';

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = location.pathname === '/manual' ? 1 : 0;

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
          Chord Uploader
        </Typography>
      </Toolbar>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(_, value) => navigate(value === 0 ? '/' : '/manual')}>
          <Tab label="Search Ultimate Guitar" />
          <Tab label="Manual Upload" />
        </Tabs>
      </Box>
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
        <Route path="/manual" element={<ManualPage />} />
      </Routes>
    </Box>
  );
}
