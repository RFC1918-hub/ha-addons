import { useState, useCallback, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box, useMediaQuery, Tabs, Tab as MuiTab } from '@mui/material';
import { Search as SearchIcon, Edit as EditIcon } from '@mui/icons-material';
import { theme } from './theme/theme';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import PreviewPane from './components/PreviewPane';
import ManualEntry from './components/ManualEntry';
import WebhookConfig from './components/WebhookConfig';
import { searchTabs, fetchTab, getWebhookConfig } from './services/api';
import type { SearchResult, Tab } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const [loadingTab, setLoadingTab] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    checkWebhookConfig();
  }, []);

  const checkWebhookConfig = async () => {
    try {
      const config = await getWebhookConfig();
      setWebhookConfigured(config.configured && config.enabled === true);
    } catch (error) {
      console.error('Failed to check webhook config:', error);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    setSelectedTab(null);
    setSelectedId('');
    try {
      const searchResults = await searchTabs(query);
      setResults(searchResults ?? []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelectTab = async (id: string) => {
    setSelectedId(id);
    setLoadingTab(true);
    try {
      const tab = await fetchTab(id);
      setSelectedTab(tab);
    } catch (error) {
      console.error('Failed to fetch tab:', error);
      setSelectedTab(null);
    } finally {
      setLoadingTab(false);
    }
  };

  const handleBack = () => {
    setSelectedTab(null);
    setSelectedId('');
  };

  const handleSettingsSaved = () => {
    checkWebhookConfig();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
        <Header onSettingsClick={() => setSettingsOpen(true)} />

        {/* Tab navigation */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 42,
            bgcolor: 'rgba(255,255,255,0.03)',
            '& .MuiTab-root': { minHeight: 42, textTransform: 'none', fontSize: '0.9rem' },
          }}
        >
          <MuiTab icon={<SearchIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Search" />
          <MuiTab icon={<EditIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Manual" />
        </Tabs>

        {activeTab === 0 && (
          /* Search tab */
          isMobile ? (
            (selectedTab || loadingTab) ? (
              <Box sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                <PreviewPane
                  tab={selectedTab}
                  loading={loadingTab}
                  webhookConfigured={webhookConfigured}
                  onBack={handleBack}
                  showBackButton
                />
              </Box>
            ) : (
              <>
                <SearchBar onSearch={handleSearch} loading={searching} />
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Box sx={{ maxWidth: 700, mx: 'auto' }}>
                    <SearchResults
                      results={results}
                      onSelect={handleSelectTab}
                      selectedId={selectedId}
                    />
                  </Box>
                </Box>
              </>
            )
          ) : (
            <>
              <SearchBar onSearch={handleSearch} loading={searching} />
              <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden', px: 2, pb: 2, gap: 2, maxWidth: 1400, mx: 'auto', width: '100%' }}>
                <Box sx={{ width: '40%', overflow: 'auto' }}>
                  <SearchResults
                    results={results}
                    onSelect={handleSelectTab}
                    selectedId={selectedId}
                  />
                </Box>
                <Box sx={{ width: '60%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                  <PreviewPane
                    tab={selectedTab}
                    loading={loadingTab}
                    webhookConfigured={webhookConfigured}
                  />
                </Box>
              </Box>
            </>
          )
        )}

        {activeTab === 1 && (
          /* Manual entry tab */
          <Box sx={{ flexGrow: 1, overflow: 'auto', maxWidth: 800, mx: 'auto', width: '100%' }}>
            <ManualEntry webhookConfigured={webhookConfigured} />
          </Box>
        )}

        <WebhookConfig
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSaved={handleSettingsSaved}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
