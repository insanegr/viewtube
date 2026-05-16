import { useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Camera, Edit3, Trash2, Settings, Eye, EyeOff, Globe, Plus, Minus, X } from 'lucide-react';
import useStore from '../store/useStore';
import { formatViews, formatDuration, timeAgo, formatCount } from '../utils/format';
import Avatar from '../components/Avatar';
import PlaylistCard from '../components/PlaylistCard';
import { useLanguage } from '../i18n/LanguageContext';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'videos';
  const { t, language } = useLanguage();
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const currentUser = useStore((s) => s.currentUser);
  const videos = useStore((s) => s.videos);
  const playlists = useStore((s) => s.playlists);
  const channels = useStore((s) => s.channels);
  const categories = useStore((s) => s.categories);
  const updateProfile = useStore((s) => s.updateProfile);
  const updateVideo = useStore((s) => s.updateVideo);
  const deleteVideo = useStore((s) => s.deleteVideo);
  const addPlaylist = useStore((s) => s.addPlaylist);
  const deletePlaylist = useStore((s) => s.deletePlaylist);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(currentUser.name);
  const [editDesc, setEditDesc] = useState(currentUser.description);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editVideoVisibility, setEditVideoVisibility] = useState<'public' | 'unlisted' | 'private' | 'vip'>('public');
  const [editVideoCategories, setEditVideoCategories] = useState<string[]>([]);
  const [editVideoTitle, setEditVideoTitle] = useState('');
  const [editVideoDesc, setEditVideoDesc] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const myVideos = videos.filter((v) => v.channelId === currentUser.id);
  const myPlaylists = playlists.filter((p) => p.channelId === currentUser.id);

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) updateProfile({ bannerImage: URL.createObjectURL(file) });
  };
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) updateProfile({ avatar: URL.createObjectURL(file) });
  };
  const handleSaveProfile = () => { updateProfile({ name: editName.trim(), description: editDesc.trim() }); setIsEditingProfile(false); };
  const startEditingVideo = (video: typeof myVideos[0]) => { setEditingVideoId(video.id); setEditVideoVisibility(video.visibility); setEditVideoCategories([...video.categories]); setEditVideoTitle(video.title); setEditVideoDesc(video.description); };
  const toggleEditCategory = (catName: string) => { setEditVideoCategories((prev) => { if (prev.includes(catName)) { if (prev.length === 1) return prev; return prev.filter((c) => c !== catName); } return [...prev, catName]; }); };
  const handleSaveVideo = async () => {
    if (!(editingVideoId && editVideoCategories.length > 0)) return;
    const originalVideo = myVideos.find((v) => v.id === editingVideoId);
    const originalPrimary = originalVideo?.categories?.[0] || null;
    const newPrimary = editVideoCategories[0] || null;

    let proceed = true;
    let forceMove = false;

    if (originalPrimary && newPrimary && originalPrimary !== newPrimary) {
      proceed = await confirmDialog({
        title: 'Move video file?',
        message: `The first category changed from "${getCategoryDisplay(originalPrimary)}" to "${getCategoryDisplay(newPrimary)}". The video file will be moved to the new category folder. Do you want to proceed?`,
        confirmText: 'Move file',
        cancelText: 'Keep editing',
        danger: false,
      });
      forceMove = proceed;
    }

    if (!proceed) return;

    updateVideo(editingVideoId, { visibility: editVideoVisibility, categories: editVideoCategories, title: editVideoTitle.trim(), description: editVideoDesc.trim() } as any);
    // Sync to API with forceMove flag
    import('../api/client').then(({ api }) => api.updateVideo(editingVideoId, { visibility: editVideoVisibility, categories: editVideoCategories, title: editVideoTitle.trim(), description: editVideoDesc.trim(), forceMove }).catch(() => {}));
    setEditingVideoId(null);
    setShowCategoryPicker(false);
    showToast('Video updated', 'success');
  };
  const handleCreatePlaylist = () => { if (newPlaylistName.trim()) { addPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim()); setNewPlaylistName(''); setNewPlaylistDesc(''); setShowNewPlaylist(false); } };
  const setTab = (newTab: string) => { setSearchParams({ tab: newTab }); };
  const visibilityIcon = (vis: string) => { switch (vis) { case 'public': return <Globe size={12} className="text-green-600" />; case 'unlisted': return <EyeOff size={12} className="text-yellow-600" />; case 'private': return <Eye size={12} className="text-red-600" />; default: return null; } };
  const getCategoryDisplay = (catName: string) => { const cat = categories.find(c => c.name === catName); return cat ? (language === 'el' ? cat.nameEl : cat.name) : catName; };

  // Shared dark input class
  const inputCls = "w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text dark:placeholder:text-dark-text-muted rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const btnSecondaryCls = "px-4 py-1.5 bg-gray-100 dark:bg-dark-card dark:text-dark-text-secondary rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-dark-hover";

  return (
    <div>
      {/* Banner */}
      <div className="relative h-40 sm:h-52 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl overflow-hidden -mx-2 sm:-mx-4 mb-6">
        {currentUser.bannerImage && <img src={currentUser.bannerImage} alt="Banner" className="w-full h-full object-cover" />}
        <button onClick={() => bannerInputRef.current?.click()} className="absolute top-3 right-3 bg-black/50 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-black/70">
          <Camera size={14} /> {currentUser.bannerImage ? t('changeBanner') : t('addBanner')}
        </button>
        <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
      </div>

      {/* Profile info */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
        <div className="relative">
          <Avatar name={currentUser.name} src={currentUser.avatar} size="xl" />
          <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 p-1.5 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-dark-hover">
            <Camera size={14} />
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
        <div className="flex-1">
          {isEditingProfile ? (
            <div className="space-y-3">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls + " !text-lg !font-bold"} />
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className={inputCls + " resize-none"} />
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{t('saveChanges')}</button>
                <button onClick={() => setIsEditingProfile(false)} className={btnSecondaryCls}>{t('cancel')}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{currentUser.name}</h1>
                <button onClick={() => { setEditName(currentUser.name); setEditDesc(currentUser.description); setIsEditingProfile(true); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full"><Edit3 size={16} /></button>
              </div>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted mt-1">{formatCount(currentUser.subscriberCount)} {t('subscribers')} • {myVideos.length} {t('videos')}</p>
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-1">{currentUser.description}</p>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-dark-border mb-6 overflow-x-auto">
        {['videos', 'playlists', 'subscribers', 'about'].map((tabName) => (
          <button key={tabName} onClick={() => setTab(tabName)} className={`px-5 py-2.5 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition ${tab === tabName ? 'border-white text-gray-900 dark:text-white' : 'border-transparent text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text-secondary'}`}>
            {t(tabName as any)}
          </button>
        ))}
      </div>

      {/* Videos Tab */}
      {tab === 'videos' && (
        <div>
          {myVideos.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
              <p className="text-lg">{t('noVideosUploaded')}</p>
              <Link to="/upload" className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-2 inline-block">{t('uploadFirstVideo')}</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myVideos.map((video) => (
                <div key={video.id} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-4">
                  {editingVideoId === video.id ? (
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <div className="w-48 aspect-video bg-gray-200 dark:bg-dark-elevated rounded-lg overflow-hidden flex-shrink-0">
                          {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-dark-elevated dark:to-dark-bg flex items-center justify-center"><Settings size={20} className="text-gray-500 dark:text-dark-text-muted" /></div>}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div><label className="text-xs font-medium text-gray-600 dark:text-dark-text-muted">{t('title')}</label><input type="text" value={editVideoTitle} onChange={(e) => setEditVideoTitle(e.target.value)} className={inputCls} /></div>
                          <div><label className="text-xs font-medium text-gray-600 dark:text-dark-text-muted">{t('description')}</label><textarea value={editVideoDesc} onChange={(e) => setEditVideoDesc(e.target.value)} rows={2} className={inputCls + " resize-none"} /></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-gray-600 dark:text-dark-text-muted">{t('visibility')}</label>
                              <select value={editVideoVisibility} onChange={(e) => setEditVideoVisibility(e.target.value as any)} className={inputCls}><option value="public">{t('public')}</option>{(currentUser.role === 'vip' || currentUser.role === 'admin') && <option value="vip">VIP only</option>}<option value="unlisted">{t('unlisted')}</option><option value="private">{t('private')}</option></select>
                            </div>
                            <div className="relative">
                              <label className="text-xs font-medium text-gray-600 dark:text-dark-text-muted">{t('categories')}</label>
                              <button type="button" onClick={() => setShowCategoryPicker(!showCategoryPicker)} className={inputCls + " flex items-center justify-between"}><span>{editVideoCategories.length} {t('selectedCategories')}</span><Plus size={14} /></button>
                              {showCategoryPicker && (<><div className="fixed inset-0 z-40" onClick={() => setShowCategoryPicker(false)} /><div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-lg shadow-lg max-h-48 overflow-y-auto">{categories.map((cat) => { const isSel = editVideoCategories.includes(cat.name); return (<button key={cat.id} type="button" onClick={() => toggleEditCategory(cat.name)} className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover ${isSel ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'dark:text-dark-text'}`}><span>{language === 'el' ? cat.nameEl : cat.name}</span><span className={`w-4 h-4 rounded-full flex items-center justify-center ${isSel ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-hover'}`}>{isSel ? <Minus size={10} /> : <Plus size={10} />}</span></button>); })}</div></>)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">{editVideoCategories.map((cn) => (<span key={cn} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">{getCategoryDisplay(cn)}{editVideoCategories.length > 1 && <button type="button" onClick={() => toggleEditCategory(cn)}><X size={10} /></button>}</span>))}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={handleSaveVideo} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{t('saveChanges')}</button>
                        <button onClick={() => { setEditingVideoId(null); setShowCategoryPicker(false); }} className={btnSecondaryCls}>{t('cancel')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <Link to={`/watch/${video.id}`} className="w-48 aspect-video bg-gray-200 dark:bg-dark-elevated rounded-lg overflow-hidden flex-shrink-0 relative">
                        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-dark-elevated dark:to-dark-bg flex items-center justify-center"><Settings size={20} className="text-gray-500 dark:text-dark-text-muted" /></div>}
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">{formatDuration(video.duration)}</span>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/watch/${video.id}`} className="font-medium hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1">{video.title}</Link>
                        <p className="text-sm text-gray-500 dark:text-dark-text-muted mt-1 line-clamp-2">{video.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-dark-text-muted">
                          <span>{formatViews(video.views)}</span><span>{timeAgo(video.uploadDate)}</span>
                          <span className="flex items-center gap-1">{visibilityIcon(video.visibility)}{video.visibility}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">{video.categories.map((cn) => (<span key={cn} className="bg-gray-100 dark:bg-dark-elevated px-2 py-0.5 rounded text-xs">{getCategoryDisplay(cn)}</span>))}</div>
                      </div>
                      <div className="flex items-start gap-1">
                        <button onClick={() => startEditingVideo(video)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full" title={t('edit')}><Edit3 size={16} /></button>
                        <button onClick={async () => { const ok = await confirmDialog({ title: t('delete'), message: t('deleteAccountWarning'), confirmText: t('delete'), danger: true }); if (ok) { deleteVideo(video.id); showToast(t('settingsSaved'), 'success'); } }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full" title={t('delete')}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Playlists Tab */}
      {tab === 'playlists' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-medium">{t('yourPlaylists')} ({myPlaylists.length})</h2>
            <button onClick={() => setShowNewPlaylist(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus size={16} />{t('newPlaylist')}</button>
          </div>
          {showNewPlaylist && (
            <div className="bg-gray-50 dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-4 mb-4">
              <h3 className="font-medium text-sm mb-3">{t('createNewPlaylist')}</h3>
              <input type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder={t('playlistName')} className={inputCls + " mb-2"} />
              <textarea value={newPlaylistDesc} onChange={(e) => setNewPlaylistDesc(e.target.value)} placeholder={t('descriptionOptional')} rows={2} className={inputCls + " mb-3 resize-none"} />
              <div className="flex gap-2">
                <button onClick={handleCreatePlaylist} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{t('create')}</button>
                <button onClick={() => setShowNewPlaylist(false)} className={btnSecondaryCls}>{t('cancel')}</button>
              </div>
            </div>
          )}
          {myPlaylists.length === 0 && !showNewPlaylist ? (
            <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted"><p className="text-lg">{t('noPlaylistsCreated')}</p><p className="text-sm mt-1">{t('createPlaylistDesc')}</p></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{myPlaylists.map((pl) => (<PlaylistCard key={pl.id} playlist={pl} onDelete={() => { confirmDialog({ title: t('delete'), message: t('deleteAccountWarning'), confirmText: t('delete'), danger: true }).then((ok) => { if (ok) { deletePlaylist(pl.id); showToast(t('settingsSaved'), 'success'); } }); }} />))}</div>
          )}
        </div>
      )}

      {/* Subscribers Tab */}
      {tab === 'subscribers' && (
        <div>
          <h2 className="font-medium mb-4">{t('subscribers')}</h2>
          {currentUser.subscriberCount === 0 && channels.length === 0 ? (<div className="text-center py-16 text-gray-500 dark:text-dark-text-muted"><p className="text-lg">{t('noSubscribersYet')}</p><p className="text-sm mt-1">{t('shareContentToGrow')}</p></div>) : null}
          <div className="space-y-3">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center gap-4 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-4">
                <Avatar name={ch.name} src={ch.avatar} size="lg" />
                <div className="flex-1">
                  <h3 className="font-medium">{ch.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-muted">{formatCount(ch.subscriberCount)} {t('subscribers')}</p>
                  <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-0.5">{ch.description}</p>
                </div>
                <div className="text-xs text-gray-400 dark:text-dark-text-muted bg-gray-100 dark:bg-dark-elevated px-3 py-1 rounded-full">{t('subscriber')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* About Tab */}
      {tab === 'about' && (
        <div className="max-w-2xl">
          <h2 className="font-medium mb-4">{t('about')}</h2>
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-6 space-y-4">
            <div><h3 className="text-sm font-medium text-gray-500 dark:text-dark-text-muted">{t('description')}</h3><p className="mt-1">{currentUser.description}</p></div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-dark-text-muted">{t('stats')}</h3>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-gray-50 dark:bg-dark-elevated rounded-lg p-3"><p className="text-2xl font-bold">{myVideos.length}</p><p className="text-sm text-gray-500 dark:text-dark-text-muted">{t('videos')}</p></div>
                <div className="bg-gray-50 dark:bg-dark-elevated rounded-lg p-3"><p className="text-2xl font-bold">{formatCount(currentUser.subscriberCount)}</p><p className="text-sm text-gray-500 dark:text-dark-text-muted">{t('subscribers')}</p></div>
                <div className="bg-gray-50 dark:bg-dark-elevated rounded-lg p-3"><p className="text-2xl font-bold">{myVideos.reduce((a, v) => a + v.views, 0).toLocaleString()}</p><p className="text-sm text-gray-500 dark:text-dark-text-muted">{t('totalViews')}</p></div>
                <div className="bg-gray-50 dark:bg-dark-elevated rounded-lg p-3"><p className="text-2xl font-bold">{myPlaylists.length}</p><p className="text-sm text-gray-500 dark:text-dark-text-muted">{t('playlists')}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
