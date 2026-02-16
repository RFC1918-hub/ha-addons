import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { Settings as SettingsIcon, MusicNote as MusicNoteIcon } from '@mui/icons-material';

interface HeaderProps {
  onSettingsClick: () => void;
}

export default function Header({ onSettingsClick }: HeaderProps) {
  return (
    <AppBar position="static" elevation={0}>
      <Toolbar>
        <MusicNoteIcon sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Ultimate Guitar Scraper
        </Typography>
        <IconButton color="inherit" onClick={onSettingsClick} aria-label="settings">
          <SettingsIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
