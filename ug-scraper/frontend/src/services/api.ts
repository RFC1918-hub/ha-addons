import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  type: string;
  rating: number;
  votes: number;
  difficulty?: string;
  url: string;
}

export interface Tab {
  id: number;
  title: string;
  artist: string;
  key: string;
  capo: number;
  tuning: string;
  difficulty: string;
  rating: number;
  votes: number;
  content: string;
  onsong_format: string;
  chords: string[];
  chord_count: number;
  url: string;
}

export interface WebhookConfig {
  configured: boolean;
  url?: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryResult {
  success: boolean;
  delivery_id: string;
  attempts: number;
  error?: string;
  duration: string;
  timestamp: string;
}

export const searchTabs = async (query: string, type?: string): Promise<SearchResult[]> => {
  const params: any = { q: query };
  if (type) params.type = type;

  const response = await api.get('/search', { params });
  // Backend returns a flat array, not { results: [...] }
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchTab = async (id: string): Promise<Tab> => {
  const response = await api.get(`/tab/${id}`);
  return response.data;
};

export const getWebhookConfig = async (): Promise<WebhookConfig> => {
  const response = await api.get('/webhook/config');
  return response.data;
};

export const saveWebhookConfig = async (url: string, enabled: boolean): Promise<void> => {
  await api.post('/webhook/config', { url, enabled });
};

export const testWebhook = async (): Promise<void> => {
  await api.post('/webhook/test');
};

export interface WebhookSendPayload {
  title: string;
  artist: string;
  content: string;
  key?: string;
  capo?: number;
}

export const sendToWebhook = async (payload: WebhookSendPayload): Promise<DeliveryResult> => {
  const response = await api.post('/webhook/send', payload);
  return response.data;
};

export const formatManualContent = async (title: string, artist: string, content: string): Promise<string> => {
  const response = await api.post('/format', { title, artist, content });
  return response.data.formatted;
};

export default api;
