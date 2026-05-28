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
  checkUsername: (username: string) => request(`/auth/check-username?q=${encodeURIComponent(username)}`),
  checkEmail: (email: string) => request(`/auth/check-email?q=${encodeURIComponent(email)}`),
  checkName: (name: string, excludeId?: string) => request(`/auth/check-name?q=${encodeURIComponent(name)}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''}`),
  requestReset: (identifier: string, note?: string) => request('/auth/request-reset', { method: 'POST', body: JSON.stringify({ identifier, note }) }),
  refresh: (refreshToken: string) => request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  getRecoveryRequests: () => request('/admin/recovery-requests'),
  resolveRecoveryRequest: (id: string) => request(`/admin/recovery-requests/${id}/reset`, { method: 'POST' }),
  dismissRecoveryRequest: (id: string) => request(`/admin/recovery-requests/${id}/dismiss`, { method: 'POST' }),
  logout: (refreshToken?: string, allDevices?: boolean) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken, allDevices }) }),
  me: () => request('/auth/me'),

  // Videos
  getVideos: (params?: { limit?: number; page?: number; category?: string; categories?: string; matchAll?: string; search?: string; visibility?: string; channelId?: string; sortBy?: string; excludeId?: string; subscribed?: string }) => {
    if (!params) return request('/videos');
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    const queryString = q.toString();
    return request(queryString ? `/videos?${queryString}` : '/videos');
  },
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
  deleteProfile: () => request('/channels/me', { method: 'DELETE' }),
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
  addComment: (videoId: string, text: string, parentId?: string | null) => request(`/videos/${videoId}/comments`, { method: 'POST', body: JSON.stringify({ text, parentId }) }),
  editComment: (id: string, text: string) => request(`/comments/${id}`, { method: 'PUT', body: JSON.stringify({ text }) }),
  deleteComment: (id: string) => request(`/comments/${id}`, { method: 'DELETE' }),

  // Playlists
  getPlaylists: () => request('/playlists'),
  getChannelPlaylists: (channelId: string) => request(`/playlists?channelId=${channelId}`),
  createPlaylist: (name: string, description: string, visibility?: string) => request('/playlists', { method: 'POST', body: JSON.stringify({ name, description, visibility }) }),
  deletePlaylist: (id: string) => request(`/playlists/${id}`, { method: 'DELETE' }),
  addToPlaylist: (id: string, videoId: string) => request(`/playlists/${id}/videos`, { method: 'POST', body: JSON.stringify({ videoId }) }),
  removeFromPlaylist: (id: string, videoId: string) => request(`/playlists/${id}/videos/${videoId}`, { method: 'DELETE' }),
  reorderPlaylist: (id: string, videoIds: string[]) => request(`/playlists/${id}/reorder`, { method: 'PUT', body: JSON.stringify({ videoIds }) }),

  // Watch History
  getHistory: () => request('/history'),
  addToHistory: (videoId: string, progress: number) => request('/history', { method: 'POST', body: JSON.stringify({ videoId, progress }) }),
  clearHistory: () => request('/history', { method: 'DELETE' }),

  // Analytics
  getAnalytics: (options?: { days?: number; videoId?: string; category?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (options) {
      if (options.days) params.append('days', String(options.days));
      if (options.videoId) params.append('videoId', options.videoId);
      if (options.category) params.append('category', options.category);
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
    } else {
      params.append('days', '30');
    }
    return request(`/analytics?${params.toString()}`);
  },
  
  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id: string) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
  clearNotifications: () => request('/notifications', { method: 'DELETE' }),

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
  downloadBackup: async (name: string) => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/admin/backups/${name}`, { headers });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  },
  downloadLiveDb: async () => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/admin/download-db`, { headers });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  },

  // System Health, Logs & Storage Cleaners
  getAdminLogs: () => request('/admin/logs'),
  getSystemHealth: () => request('/admin/health'),
  cleanerScan: () => request('/admin/cleaner/scan'),
  cleanerPurge: (filePaths: string[]) => request('/admin/cleaner/purge', { method: 'POST', body: JSON.stringify({ filePaths }) }),
  cleanerRepairDb: (videoIds: string[]) => request('/admin/cleaner/repair-db', { method: 'POST', body: JSON.stringify({ videoIds }) }),

  // Reports
  submitReport: (type: 'video' | 'comment' | 'ban_request', targetId: string, reason: string, details?: string) =>
    request('/reports', { method: 'POST', body: JSON.stringify({ type, targetId, reason, details }) }),
  getReports: () => request('/reports'),
  updateReportStatus: (id: string, status: 'resolved' | 'dismissed') =>
    request(`/reports/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  // Moderation (Mute / Mute Unmute)
  muteUser: (userId: string, durationDays: number) =>
    request(`/admin/users/${userId}/mute`, { method: 'POST', body: JSON.stringify({ durationDays }) }),
  unmuteUser: (userId: string) =>
    request(`/admin/users/${userId}/unmute`, { method: 'POST' }),

  // Ban / Unban
  banUser: (userId: string, durationDays?: number, reason?: string) =>
    request(`/admin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ durationDays, reason }) }),
  unbanUser: (userId: string) =>
    request(`/admin/users/${userId}/unban`, { method: 'POST' }),

  // User Moderation History and Statistics
  getUserModerationHistory: (userId: string) =>
    request(`/admin/users/${userId}/moderation-history`),
};
