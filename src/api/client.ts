const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

// ── Token storage ──
function getAccessToken(): string | null {
  return localStorage.getItem('viewtube-token');
}
function getRefreshToken(): string | null {
  return localStorage.getItem('viewtube-refresh-token');
}

export function setTokens(access: string | null, refresh?: string | null) {
  if (access) localStorage.setItem('viewtube-token', access);
  else localStorage.removeItem('viewtube-token');
  if (refresh !== undefined) {
    if (refresh) localStorage.setItem('viewtube-refresh-token', refresh);
    else localStorage.removeItem('viewtube-refresh-token');
  }
}

export function clearTokens() {
  localStorage.removeItem('viewtube-token');
  localStorage.removeItem('viewtube-refresh-token');
}

// ── Refresh lock to prevent multiple simultaneous refreshes ──
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return false;
      }

      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Request helper with auto-refresh ──
async function request(url: string, options: RequestInit = {}, retried = false): Promise<any> {
  const token = getAccessToken();
  const headers: Record<string, string> = { ...(options.headers as any || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  // If 401 and we haven't retried yet, try refreshing
  if (res.status === 401 && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request(url, options, true);
    }
    clearTokens();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth — these return { accessToken, refreshToken, user }
  login: (identifier: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  register: (name: string, username: string, email: string, password: string) => request('/auth/register', { method: 'POST', body: JSON.stringify({ name, username, email, password }) }),
  requestReset: (identifier: string, note?: string) => request('/auth/request-reset', { method: 'POST', body: JSON.stringify({ identifier, note }) }),
  refresh: (refreshToken: string) => request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  getRecoveryRequests: () => request('/admin/recovery-requests'),
  resolveRecoveryRequest: (id: string) => request(`/admin/recovery-requests/${id}/reset`, { method: 'POST' }),
  dismissRecoveryRequest: (id: string) => request(`/admin/recovery-requests/${id}/dismiss`, { method: 'POST' }),
  logout: (refreshToken?: string, allDevices?: boolean) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken, allDevices }) }),
  me: () => request('/auth/me'),

  // Videos
  getVideos: () => request('/videos'),
  getVideo: (id: string) => request(`/videos/${id}`),
  viewVideo: (id: string) => request(`/videos/${id}/view`, { method: 'POST' }),
  uploadVideo: (formData: FormData) => request('/videos', { method: 'POST', body: formData }),
  updateVideo: (id: string, data: any) => request(`/videos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVideo: (id: string) => request(`/videos/${id}`, { method: 'DELETE' }),
  likeVideo: (id: string) => request(`/videos/${id}/like`, { method: 'POST' }),
  dislikeVideo: (id: string) => request(`/videos/${id}/dislike`, { method: 'POST' }),

  // Channels
  getChannels: () => request('/channels'),
  updateProfile: (formData: FormData) => request('/channels/me', { method: 'PUT', body: formData }),
  updateRole: (id: string, role: string) => request(`/channels/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  // Subscriptions
  toggleSubscribe: (channelId: string) => request(`/subscribe/${channelId}`, { method: 'POST' }),
  getSubscriptions: () => request('/subscriptions'),

  // Categories
  getCategories: () => request('/categories'),
  addCategory: (name: string, nameEl: string) => request('/categories', { method: 'POST', body: JSON.stringify({ name, nameEl }) }),
  updateCategory: (id: string, name: string, nameEl: string) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name, nameEl }) }),
  deleteCategory: (id: string) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Comments
  getComments: (videoId: string) => request(`/videos/${videoId}/comments`),
  addComment: (videoId: string, text: string) => request(`/videos/${videoId}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),

  // Playlists
  getPlaylists: () => request('/playlists'),
  createPlaylist: (name: string, description: string) => request('/playlists', { method: 'POST', body: JSON.stringify({ name, description }) }),
  deletePlaylist: (id: string) => request(`/playlists/${id}`, { method: 'DELETE' }),
  addToPlaylist: (id: string, videoId: string) => request(`/playlists/${id}/videos`, { method: 'POST', body: JSON.stringify({ videoId }) }),
  removeFromPlaylist: (id: string, videoId: string) => request(`/playlists/${id}/videos/${videoId}`, { method: 'DELETE' }),
  reorderPlaylist: (id: string, videoIds: string[]) => request(`/playlists/${id}/reorder`, { method: 'PUT', body: JSON.stringify({ videoIds }) }),

  // Watch History
  getHistory: () => request('/history'),
  addToHistory: (videoId: string, progress: number) => request('/history', { method: 'POST', body: JSON.stringify({ videoId, progress }) }),
  clearHistory: () => request('/history', { method: 'DELETE' }),

  // Analytics
  getAnalytics: (days?: number) => request(`/analytics?days=${days || 30}`),

  // Import
  browseImport: (path = '') => request(`/import/browse?path=${encodeURIComponent(path)}`),
  scanImport: (path = '', recursive = true) => request(`/import/scan?path=${encodeURIComponent(path)}&recursive=${recursive}`),
  runImport: (data: { files: { path: string; primaryCategory: string; additionalCategories: string[]; visibility: string }[]; mode: string; defaultCategory: string; defaultVisibility: string; defaultAdditionalCategories?: string[] }) =>
    request('/import/run', { method: 'POST', body: JSON.stringify(data) }),

  // Admin backups
  getStorage: () => request('/admin/storage'),
  getBackups: () => request('/admin/backups'),
  createBackup: () => request('/admin/backups', { method: 'POST' }),
  deleteBackup: (name: string) => request(`/admin/backups/${name}`, { method: 'DELETE' }),
  restoreBackup: (formData: FormData) => request('/admin/restore', { method: 'POST', body: formData }),
};
