import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type UserRole = 'user' | 'vip' | 'vip+' | 'vip++' | 'moderator' | 'moderator_vip_plus' | 'moderator_vip_plus_plus' | 'admin';
export type Theme = 'light' | 'dark' | 'auto';

export interface Video { id: string; title: string; description: string; thumbnailUrl: string; videoUrl: string; duration: number; views: number; likes: number; dislikes: number; uploadDate: string; channelId: string; channelName: string; channelAvatar: string; channelRole?: string; visibility: 'public' | 'unlisted' | 'private' | 'user' | 'vip' | 'vip+' | 'vip++'; categories: string[]; }
export interface Playlist { id: string; name: string; description: string; coverThumbnail: string; videoIds: string[]; channelId: string; createdAt: string; visibility?: string; }
export interface Channel { id: string; name: string; username: string; email: string; password: string; avatar: string; bannerImage: string; description: string; subscriberCount: number; subscribers: string[]; role: UserRole; notificationsEnabled: boolean; mustChangePassword: boolean; country: string; bellEnabled?: boolean; audioChimeEnabled?: boolean; siteNotificationsEnabled?: boolean; mutedUntil?: string | null; banned?: boolean; }
export interface Comment { id: string; videoId: string; channelId: string; channelName: string; channelAvatar: string; text: string; date: string; likes: number; parentId: string | null; }
export interface Category { id: string; name: string; nameEl: string; }
export interface WatchHistoryEntry { videoId: string; watchedAt: string; progress: number; }
export type NotificationType = 'comment' | 'reply' | 'subscribe' | 'like' | 'role_upgrade';
export interface Notification { id: string; type: NotificationType; fromChannelId: string; fromChannelName: string; fromChannelAvatar: string; videoId?: string; videoTitle?: string; commentText?: string; newRole?: string; read: boolean; date: string; }

export interface MiniPlayerState {
  enabled: boolean;
  active: boolean;
  videoId: string | null;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  source: 'none' | 'playlist' | 'queue' | 'suggested';
  sequence: string[];
  playlistId: string | null;
}

interface AppState {
  currentUser: Channel; channels: Channel[]; videos: Video[]; playlists: Playlist[]; comments: Comment[]; categories: Category[];
  subscribedChannels: string[]; likedVideos: string[]; dislikedVideos: string[]; theme: Theme; selectedCategories: string[];
  matchAllCategories: boolean; queue: string[]; playlistQueue: string[]; playlistLoop: boolean; playlistShuffle: boolean; watchLater: string[]; miniPlayerVideoId: string | null; miniPlayer: MiniPlayerState; notifications: Notification[]; watchHistory: WatchHistoryEntry[];
  addToHistory: (videoId: string) => void; updateWatchProgress: (videoId: string, progress: number) => void; clearHistory: () => void;
  setMiniPlayerEnabled: (value: boolean) => void; openMiniPlayer: (payload: Partial<Omit<MiniPlayerState, 'enabled' | 'active'>> & { videoId: string }) => void; updateMiniPlayer: (payload: Partial<Omit<MiniPlayerState, 'enabled'>>) => void; closeMiniPlayer: () => void;
  addNotification: (notif: Omit<Notification, 'id' | 'read' | 'date'>) => void; markNotificationRead: (id: string) => void; markAllNotificationsRead: () => void; clearNotifications: () => void;
  addToQueue: (videoId: string) => void; removeFromQueue: (videoId: string) => void; clearQueue: () => void; playNext: () => string | null;
  setPlaylistQueue: (videoIds: string[]) => void; clearPlaylistQueue: () => void; playNextFromPlaylist: () => string | null;
  setPlaylistLoop: (value: boolean) => void; setPlaylistShuffle: (value: boolean) => void;
  addToWatchLater: (videoId: string) => void; removeFromWatchLater: (videoId: string) => void;
  setMiniPlayerVideo: (videoId: string | null) => void;
  addVideo: (video: Omit<Video, 'id' | 'views' | 'likes' | 'dislikes' | 'uploadDate' | 'channelId' | 'channelName' | 'channelAvatar'>) => void;
  addVideos: (videos: Omit<Video, 'id' | 'views' | 'likes' | 'dislikes' | 'uploadDate' | 'channelId' | 'channelName' | 'channelAvatar'>[]) => void;
  updateVideo: (videoId: string, updates: Partial<Pick<Video, 'title' | 'description' | 'visibility' | 'categories'>>) => void;
  deleteVideo: (videoId: string) => void; incrementViews: (videoId: string) => void; toggleLike: (videoId: string) => void; toggleDislike: (videoId: string) => void;
  addPlaylist: (name: string, description: string, visibility?: string) => string; updatePlaylistCover: (playlistId: string, coverUrl: string) => void;
  addVideoToPlaylist: (playlistId: string, videoId: string) => void; removeVideoFromPlaylist: (playlistId: string, videoId: string) => void;
  reorderPlaylistVideos: (playlistId: string, videoIds: string[]) => void; deletePlaylist: (playlistId: string) => void;
  updateProfile: (updates: Partial<Pick<Channel, 'name' | 'avatar' | 'description' | 'bannerImage' | 'email' | 'password' | 'notificationsEnabled' | 'country' | 'bellEnabled' | 'audioChimeEnabled' | 'siteNotificationsEnabled'>>) => void;
  toggleSubscribe: (channelId: string) => void; updateUserRole: (channelId: string, role: UserRole) => void;
  addCategory: (name: string, nameEl: string) => void; updateCategory: (categoryId: string, name: string, nameEl: string) => void; deleteCategory: (categoryId: string) => void;
  toggleCategoryFilter: (categoryName: string) => void; clearCategoryFilters: () => void; setMatchAllCategories: (matchAll: boolean) => void;
  setTheme: (theme: Theme) => void; addComment: (videoId: string, text: string, parentId?: string | null) => void;
  editComment: (commentId: string, text: string) => Promise<void>; deleteComment: (commentId: string) => Promise<void>;
}

const emptyUser: Channel = { id: '', name: '', username: '', email: '', password: '', avatar: '', bannerImage: '', description: '', subscriberCount: 0, subscribers: [], role: 'user', notificationsEnabled: false, mustChangePassword: false, country: 'US' };

// Temporary playlist IDs need to resolve to real server IDs before follow-up actions.
const playlistCreatePromises = new Map<string, Promise<string>>();
async function resolvePlaylistId(id: string): Promise<string> {
  const p = playlistCreatePromises.get(id);
  return p ? p.catch(() => id) : id;
}

const getInitialTheme = (): Theme => { if (typeof window !== 'undefined') { const s = localStorage.getItem('viewtube-theme'); if (s === 'light' || s === 'dark' || s === 'auto') return s; } return 'auto'; };
const getInitialMiniPlayerEnabled = (): boolean => { if (typeof window !== 'undefined') { const s = localStorage.getItem('viewtube-miniplayer-enabled'); if (s !== null) return s === 'true'; } return false; };

const useStore = create<AppState>((set, get) => ({
  currentUser: emptyUser, channels: [], videos: [], playlists: [], comments: [], categories: [],
  subscribedChannels: [], likedVideos: [], dislikedVideos: [], theme: getInitialTheme(),
  selectedCategories: [], matchAllCategories: false, queue: [], playlistQueue: [], playlistLoop: false, playlistShuffle: false, watchLater: [], miniPlayerVideoId: null,
  miniPlayer: { enabled: getInitialMiniPlayerEnabled(), active: false, videoId: null, currentTime: 0, isPlaying: false, volume: 1, isMuted: false, playbackSpeed: 1, source: 'none', sequence: [], playlistId: null },
  watchHistory: [], notifications: [],

  setMiniPlayerEnabled: (value) => { if (typeof window !== 'undefined') localStorage.setItem('viewtube-miniplayer-enabled', String(value)); set((s) => ({ miniPlayer: { ...s.miniPlayer, enabled: value } })); },
  openMiniPlayer: (payload) => set((s) => ({ miniPlayer: { ...s.miniPlayer, ...payload, active: true } })),
  updateMiniPlayer: (payload) => set((s) => ({ miniPlayer: { ...s.miniPlayer, ...payload } })),
  closeMiniPlayer: () => set((s) => ({ miniPlayer: { ...s.miniPlayer, active: false, videoId: null, isPlaying: false, currentTime: 0 } })),

  addToHistory: (videoId) => { set((s) => ({ watchHistory: [{ videoId, watchedAt: new Date().toISOString(), progress: 0 }, ...s.watchHistory.filter((h) => h.videoId !== videoId)] })); import('../api/client').then(({ api }) => api.addToHistory(videoId, 0).catch(() => {})); },
  updateWatchProgress: (videoId, progress) => { set((s) => ({ watchHistory: s.watchHistory.map((h) => h.videoId === videoId ? { ...h, progress: Math.max(h.progress, progress) } : h) })); import('../api/client').then(({ api }) => api.addToHistory(videoId, progress).catch(() => {})); },
  clearHistory: () => set({ watchHistory: [] }),

  addNotification: (notif) => {
    const { currentUser } = get();
    if (currentUser.siteNotificationsEnabled !== false && currentUser.audioChimeEnabled !== false) {
      import('../utils/audio').then(({ playNotificationChime }) => {
        playNotificationChime();
      }).catch(() => {});
    }
    set((s) => ({ notifications: [{ ...notif, id: `n-${uuidv4()}`, read: false, date: new Date().toISOString() }, ...s.notifications] }));
  },
  markNotificationRead: (id) => { 
    set((s) => ({ notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) }));
    import('../api/client').then(({ api }) => api.markNotificationRead(id).catch(() => {}));
  },
  markAllNotificationsRead: () => { 
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    import('../api/client').then(({ api }) => api.markAllNotificationsRead().catch(() => {}));
  },
  clearNotifications: () => {
    set({ notifications: [] });
    import('../api/client').then(({ api }) => api.clearNotifications().catch(() => {}));
  },

  addToQueue: (videoId) => { set((s) => ({ queue: s.queue.includes(videoId) ? s.queue : [...s.queue, videoId] })); },
  removeFromQueue: (videoId) => { set((s) => ({ queue: s.queue.filter((id) => id !== videoId) })); },
  clearQueue: () => set({ queue: [] }),
  playNext: () => { const { queue } = get(); if (queue.length === 0) return null; const next = queue[0]; set({ queue: queue.slice(1) }); return next; },
  setPlaylistQueue: (videoIds) => set({ playlistQueue: videoIds }),
  clearPlaylistQueue: () => set({ playlistQueue: [] }),
  playNextFromPlaylist: () => { const { playlistQueue } = get(); if (playlistQueue.length === 0) return null; const next = playlistQueue[0]; set({ playlistQueue: playlistQueue.slice(1) }); return next; },
  setPlaylistLoop: (value) => set({ playlistLoop: value }),
  setPlaylistShuffle: (value) => set({ playlistShuffle: value }),
  addToWatchLater: (videoId) => set((s) => ({ watchLater: s.watchLater.includes(videoId) ? s.watchLater : [...s.watchLater, videoId] })),
  removeFromWatchLater: (videoId) => set((s) => ({ watchLater: s.watchLater.filter((id) => id !== videoId) })),
  setMiniPlayerVideo: (videoId) => set({ miniPlayerVideoId: videoId }),

  addVideo: (d) => { const { currentUser: u } = get(); set((s) => ({ videos: [{ ...d, id: `v-${uuidv4()}`, views: 0, likes: 0, dislikes: 0, uploadDate: new Date().toISOString().split('T')[0], channelId: u.id, channelName: u.name, channelAvatar: u.avatar }, ...s.videos] })); },
  addVideos: (ds) => { const { currentUser: u } = get(); const nv = ds.map((d) => ({ ...d, id: `v-${uuidv4()}`, views: 0, likes: 0, dislikes: 0, uploadDate: new Date().toISOString().split('T')[0], channelId: u.id, channelName: u.name, channelAvatar: u.avatar })); set((s) => ({ videos: [...nv, ...s.videos] })); },
  updateVideo: (vid, ups) => {
    set((s) => ({
      videos: s.videos.map((v) => {
        if (v.id !== vid) return v;
        const isOwner = v.channelId === s.currentUser.id;
        const isAdmin = s.currentUser.role === 'admin';
        const callerRole = s.currentUser.role;
        const owner = s.channels.find(c => c.id === v.channelId);
        const ownerRole = v.channelRole || owner?.role || 'user';
        let canEdit = isOwner || isAdmin;
        if (callerRole === 'moderator' && (ownerRole === 'user' || ownerRole === 'vip')) {
          canEdit = true;
        } else if (callerRole === 'moderator_vip_plus' && (ownerRole === 'user' || ownerRole === 'vip' || ownerRole === 'vip+')) {
          canEdit = true;
        } else if (callerRole === 'moderator_vip_plus_plus' && (ownerRole === 'user' || ownerRole === 'vip' || ownerRole === 'vip+' || ownerRole === 'vip++')) {
          canEdit = true;
        }
        return canEdit ? { ...v, ...ups } : v;
      })
    }));
    import('../api/client').then(({ api }) => api.updateVideo(vid, ups).catch(() => {}));
  },
  deleteVideo: (vid) => {
    set((s) => ({
      videos: s.videos.filter((v) => {
        if (v.id !== vid) return true;
        const isOwner = v.channelId === s.currentUser.id;
        const isAdmin = s.currentUser.role === 'admin';
        const callerRole = s.currentUser.role;
        const owner = s.channels.find(c => c.id === v.channelId);
        const ownerRole = v.channelRole || owner?.role || 'user';
        let canDelete = isOwner || isAdmin;
        if (callerRole === 'moderator' && (ownerRole === 'user' || ownerRole === 'vip')) {
          canDelete = true;
        } else if (callerRole === 'moderator_vip_plus' && (ownerRole === 'user' || ownerRole === 'vip' || ownerRole === 'vip+')) {
          canDelete = true;
        } else if (callerRole === 'moderator_vip_plus_plus' && (ownerRole === 'user' || ownerRole === 'vip' || ownerRole === 'vip+' || ownerRole === 'vip++')) {
          canDelete = true;
        }
        return !canDelete;
      }),
      playlists: s.playlists.map((p) => ({ ...p, videoIds: p.videoIds.filter((id) => id !== vid) }))
    }));
    import('../api/client').then(({ api }) => api.deleteVideo(vid).catch(() => {}));
  },
  incrementViews: (vid) => {
    set((s) => ({ videos: s.videos.map((v) => v.id === vid ? { ...v, views: v.views + 1 } : v) }));
    import('../api/client').then(({ api }) => api.viewVideo(vid).catch(() => {}));
  },

  toggleLike: (videoId) => {
    const { likedVideos, dislikedVideos } = get();
    const isLiked = likedVideos.includes(videoId); const isDisliked = dislikedVideos.includes(videoId);
    set((s) => ({ likedVideos: isLiked ? likedVideos.filter((id) => id !== videoId) : [...likedVideos, videoId], dislikedVideos: isDisliked ? dislikedVideos.filter((id) => id !== videoId) : dislikedVideos, videos: s.videos.map((v) => v.id !== videoId ? v : { ...v, likes: isLiked ? v.likes - 1 : v.likes + 1, dislikes: isDisliked ? v.dislikes - 1 : v.dislikes }) }));
    import('../api/client').then(({ api }) => api.likeVideo(videoId).catch(() => {}));
  },
  toggleDislike: (videoId) => {
    const { likedVideos, dislikedVideos } = get(); const isLiked = likedVideos.includes(videoId); const isDisliked = dislikedVideos.includes(videoId);
    set((s) => ({ dislikedVideos: isDisliked ? dislikedVideos.filter((id) => id !== videoId) : [...dislikedVideos, videoId], likedVideos: isLiked ? likedVideos.filter((id) => id !== videoId) : likedVideos, videos: s.videos.map((v) => v.id !== videoId ? v : { ...v, dislikes: isDisliked ? v.dislikes - 1 : v.dislikes + 1, likes: isLiked ? v.likes - 1 : v.likes }) }));
    import('../api/client').then(({ api }) => api.dislikeVideo(videoId).catch(() => {}));
  },

  addPlaylist: (name, desc, visibility = 'public') => {
    const tempId = `pl-${uuidv4()}`;
    set((s) => ({ playlists: [...s.playlists, { id: tempId, name, description: desc, coverThumbnail: '', videoIds: [], channelId: get().currentUser.id, createdAt: new Date().toISOString(), visibility }] }));
    const creationPromise = import('../api/client').then(({ api }) => api.createPlaylist(name, desc, visibility).then((pl: any) => {
      if (!pl?.id) return tempId;
      set((s) => ({ playlists: s.playlists.map((p) => p.id === tempId ? { ...p, id: pl.id, createdAt: pl.createdAt || p.createdAt, visibility: pl.visibility || p.visibility } : p) }));
      playlistCreatePromises.delete(tempId);
      return pl.id as string;
    }).catch(() => {
      playlistCreatePromises.delete(tempId);
      return tempId;
    }));
    playlistCreatePromises.set(tempId, creationPromise);
    return tempId;
  },
  updatePlaylistCover: (pid, url) => {
    set((s) => ({ playlists: s.playlists.map((p) => p.id === pid ? { ...p, coverThumbnail: url } : p) }));
  },
  addVideoToPlaylist: (pid, vid) => {
    set((s) => ({ playlists: s.playlists.map((p) => p.id !== pid ? p : p.videoIds.includes(vid) ? p : { ...p, videoIds: [...p.videoIds, vid] }) }));
    resolvePlaylistId(pid).then((realId) => import('../api/client').then(({ api }) => api.addToPlaylist(realId, vid).catch(() => {})));
  },
  removeVideoFromPlaylist: (pid, vid) => {
    set((s) => ({ playlists: s.playlists.map((p) => p.id === pid ? { ...p, videoIds: p.videoIds.filter((id) => id !== vid) } : p) }));
    resolvePlaylistId(pid).then((realId) => import('../api/client').then(({ api }) => api.removeFromPlaylist(realId, vid).catch(() => {})));
  },
  reorderPlaylistVideos: (pid, vids) => {
    set((s) => ({ playlists: s.playlists.map((p) => p.id === pid ? { ...p, videoIds: vids } : p) }));
    resolvePlaylistId(pid).then((realId) => import('../api/client').then(({ api }) => api.reorderPlaylist(realId, vids).catch(() => {})));
  },
  deletePlaylist: (pid) => {
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== pid) }));
    resolvePlaylistId(pid).then((realId) => import('../api/client').then(({ api }) => api.deletePlaylist(realId).catch(() => {})));
  },

  updateProfile: (ups) => { set((s) => ({ currentUser: { ...s.currentUser, ...ups } })); },
  toggleSubscribe: (channelId) => {
    const { currentUser, subscribedChannels } = get();
    if (currentUser.id === channelId) return; // Users should not be able to subscribe to their own channel
    const isSub = subscribedChannels.includes(channelId);
    set((s) => ({
      subscribedChannels: isSub ? subscribedChannels.filter((id) => id !== channelId) : [...subscribedChannels, channelId],
      channels: s.channels.map((c) =>
        c.id !== channelId
          ? c
          : {
              ...c,
              subscriberCount: isSub ? c.subscriberCount - 1 : c.subscriberCount + 1,
              subscribers: (c.subscribers || []).includes(s.currentUser.id)
                ? (c.subscribers || []).filter((id) => id !== s.currentUser.id)
                : [...(c.subscribers || []), s.currentUser.id],
            }
      ),
    }));
    import('../api/client').then(({ api }) => api.toggleSubscribe(channelId).catch(() => {}));
  },
  updateUserRole: (cid, role) => {
    set((s) => ({ channels: s.channels.map((c) => c.id === cid ? { ...c, role } : c) }));
    import('../api/client').then(({ api }) => api.updateRole(cid, role).catch(() => {}));
  },

  addCategory: (name, nameEl) => {
    const existing = get().categories;
    if (existing.some((c) => c.name === name)) return;
    const tempId = `cat-${uuidv4()}`;
    set((s) => ({ categories: [...s.categories, { id: tempId, name, nameEl }] }));
    import('../api/client').then(({ api }) => api.addCategory(name, nameEl).then((cat: any) => {
      if (cat?.id) set((s) => ({ categories: s.categories.map((c) => c.id === tempId ? { ...c, id: cat.id } : c) }));
    }).catch(() => {}));
  },
  updateCategory: (cid, name, nameEl) => { set((s) => ({ categories: s.categories.map((c) => c.id === cid ? { ...c, name, nameEl } : c) })); },
  deleteCategory: (cid) => { const cat = get().categories.find((c) => c.id === cid); if (!cat) return; set((s) => ({ categories: s.categories.filter((c) => c.id !== cid), videos: s.videos.map((v) => ({ ...v, categories: v.categories.filter((c) => c !== cat.name).length > 0 ? v.categories.filter((c) => c !== cat.name) : ['Entertainment'] })) })); },

  toggleCategoryFilter: (cn) => { const { selectedCategories: sc } = get(); set({ selectedCategories: sc.includes(cn) ? sc.filter((c) => c !== cn) : [...sc, cn] }); },
  clearCategoryFilters: () => set({ selectedCategories: [] }),
  setMatchAllCategories: (m) => set({ matchAllCategories: m }),
  setTheme: (theme) => { if (typeof window !== 'undefined') localStorage.setItem('viewtube-theme', theme); set({ theme }); },

  addComment: (videoId, text, parentId = null) => {
    const { currentUser, videos, comments, addNotification } = get();
    const tempId = `c-${uuidv4()}`;
    const comment: Comment = { id: tempId, videoId, channelId: currentUser.id, channelName: currentUser.name, channelAvatar: currentUser.avatar, text, date: new Date().toISOString().split('T')[0], likes: 0, parentId };
    set((s) => ({ comments: [...s.comments, comment] }));

    import('../api/client').then(({ api }) => {
      api.addComment(videoId, text, parentId).then((res: any) => {
        if (res && res.id) {
          set((s) => ({
            comments: s.comments.map((c) => c.id === tempId ? { ...c, id: res.id } : c)
          }));
        }
      }).catch(() => {});
    });

    const video = videos.find((v) => v.id === videoId);
    if (parentId) { const pc = comments.find((c) => c.id === parentId); if (pc && pc.channelId !== currentUser.id) addNotification({ type: 'reply', fromChannelId: currentUser.id, fromChannelName: currentUser.name, fromChannelAvatar: currentUser.avatar, videoId, videoTitle: video?.title, commentText: text }); }
    else if (video && video.channelId !== currentUser.id) addNotification({ type: 'comment', fromChannelId: currentUser.id, fromChannelName: currentUser.name, fromChannelAvatar: currentUser.avatar, videoId, videoTitle: video.title, commentText: text });
  },
  editComment: async (commentId, text) => {
    const { api } = await import('../api/client');
    const updated = await api.editComment(commentId, text);
    if (updated && updated.id) {
      set((s) => ({
        comments: s.comments.map((c) => c.id === commentId ? { ...c, text: updated.text } : c)
      }));
    }
  },
  deleteComment: async (commentId) => {
    const { api } = await import('../api/client');
    await api.deleteComment(commentId);
    set((s) => ({
      comments: s.comments.filter((c) => c.id !== commentId && c.parentId !== commentId)
    }));
  },
}));

export async function initializeFromAPI() {
  try {
    const { api } = await import('../api/client');
    const [videos, channels, categories] = await Promise.all([api.getVideos().catch(() => null), api.getChannels().catch(() => null), api.getCategories().catch(() => null)]);
    if (videos) useStore.setState({ videos }); if (channels) useStore.setState({ channels }); if (categories) useStore.setState({ categories });
    const { clearTokens } = await import('../api/client');
    const token = localStorage.getItem('viewtube-token');
    
    const refreshData = async () => {
      const curToken = localStorage.getItem('viewtube-token');
      if (!curToken) return;
      try {
        const [notifs, user, videos, channels] = await Promise.all([
          api.getNotifications().catch(() => []),
          api.me().catch(() => null),
          api.getVideos().catch(() => null),
          api.getChannels().catch(() => null)
        ]);

        const currentNotifications = useStore.getState().notifications;
        const currentUnreadCount = currentNotifications.filter((n) => !n.read).length;
        const newUnreadCount = notifs.filter((n: any) => !n.read).length;
        const currentUser = useStore.getState().currentUser;

        if (
          newUnreadCount > currentUnreadCount &&
          currentUser.siteNotificationsEnabled !== false &&
          currentUser.audioChimeEnabled !== false
        ) {
          import('../utils/audio').then(({ playNotificationChime }) => {
            playNotificationChime();
          }).catch(() => {});
        }

        if (notifs) useStore.setState({ notifications: notifs });
        if (user) useStore.setState({ currentUser: { ...useStore.getState().currentUser, ...user, password: '' } as any });
        if (videos) useStore.setState({ videos });
        if (channels) useStore.setState({ channels });
      } catch {}
    };

    if (token) {
      try {
        const user = await api.me();
        if (user) {
          useStore.setState({ 
            currentUser: { ...useStore.getState().currentUser, ...user, subscribers: [], password: '' },
            likedVideos: (user as any).likedVideos || [],
            dislikedVideos: (user as any).dislikedVideos || []
          });
        }
        const subs = await api.getSubscriptions().catch(() => []); if (subs) useStore.setState({ subscribedChannels: subs });
        const playlists = await api.getPlaylists().catch(() => []); if (playlists) useStore.setState({ playlists });
        const history = await api.getHistory().catch(() => []); if (history) useStore.setState({ watchHistory: history });
        const notifs = await api.getNotifications().catch(() => []); if (notifs) useStore.setState({ notifications: notifs });
        
        // Start polling every 10 seconds for real-time feel
        setInterval(refreshData, 10000);
      } catch { clearTokens(); }
    }
  } catch { /* API not available */ }
}

export default useStore;
