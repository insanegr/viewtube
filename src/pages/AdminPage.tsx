import { useMemo, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, Star, User, Plus, Edit3, Trash2, X, Check, FolderTree, KeyRound, Database, ChevronRight, Film, Bell, Search, Globe, EyeOff, Eye, CheckSquare, Square, Flag, VolumeX, Ban, History } from 'lucide-react';
import useStore, { UserRole } from '../store/useStore';
import { api } from '../api/client';
import UserModerationHistoryModal from '../components/UserModerationHistoryModal';
import { useLanguage } from '../i18n/LanguageContext';
import Avatar from '../components/Avatar';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import ImportPage from './ImportPage';
import BackupPage from './BackupPage';
import RecoveryRequestsPage from './RecoveryRequestsPage';
import SystemHealthSection from './SystemHealthSection';
import ReportsManagementPanel from './ReportsManagementPanel';
import { getAllowedVisibility } from '../constants';
import { formatViews, timeAgo } from '../utils/format';

type AdminSection = 'overview' | 'users' | 'videos' | 'recovery' | 'categories' | 'import' | 'backups' | 'health' | 'reports';

export const getRoleLabel = (role: UserRole): string => {
  switch (role) {
    case 'admin': return 'Admin';
    case 'moderator': return 'Mod';
    case 'moderator_vip_plus': return 'Mod+';
    case 'moderator_vip_plus_plus': return 'Mod++';
    case 'vip++': return 'VIP++';
    case 'vip+': return 'VIP+';
    case 'vip': return 'VIP';
    default: return 'User';
  }
};

export const getRoleIcon = (role: UserRole) => {
  switch (role) {
    case 'admin': return <Shield size={14} className="text-red-500" />;
    case 'moderator': return <Shield size={14} className="text-blue-500" />;
    case 'moderator_vip_plus': return <Shield size={14} className="text-orange-500" />;
    case 'moderator_vip_plus_plus': return <Shield size={14} className="text-purple-500" />;
    case 'vip++': return <Star size={14} className="text-purple-500" fill="currentColor" />;
    case 'vip+': return <Star size={14} className="text-orange-500" fill="currentColor" />;
    case 'vip': return <Star size={14} className="text-yellow-500" fill="currentColor" />;
    default: return <User size={14} className="text-gray-400 dark:text-dark-text-muted" />;
  }
};

export const getRoleBadge = (role: UserRole) => {
  switch (role) {
    case 'admin': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'moderator': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'moderator_vip_plus': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'moderator_vip_plus_plus': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'vip++': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'vip+': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'vip': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    default: return 'bg-gray-100 text-gray-700 dark:bg-dark-hover dark:text-dark-text-secondary';
  }
};

function VideoManagementPanel() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const videos = useStore((s) => s.videos);
  const categories = useStore((s) => s.categories);
  const updateVideo = useStore((s) => s.updateVideo);
  const deleteVideo = useStore((s) => s.deleteVideo);
  const channels = useStore((s) => s.channels);
  const currentUser = useStore((s) => s.currentUser);

  const [search, setSearch] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editVisibility, setEditVisibility] = useState<any>('');
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [bulkVisibility, setBulkVisibility] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkSubcategory, setBulkSubcategory] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase()) || 
                          v.channelName.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (currentUser.role === 'admin') return true;
    if (v.channelId === currentUser.id) return true;
    const owner = channels.find(c => c.id === v.channelId);
    const ownerRole = v.channelRole || owner?.role;
    if (!ownerRole) return false; // Be safe and hide if owner info is not yet populated
    if (ownerRole === 'admin') return false; // Never let mods see/edit admin video uploads

    if (currentUser.role === 'moderator') {
      if (v.visibility === 'vip++') return false;
      return ownerRole === 'user' || ownerRole === 'vip';
    }
    if (currentUser.role === 'moderator_vip_plus') {
      if (v.visibility === 'vip++') return false;
      return ownerRole === 'user' || ownerRole === 'vip' || ownerRole === 'vip+';
    }
    if (currentUser.role === 'moderator_vip_plus_plus') {
      return ownerRole === 'user' || ownerRole === 'vip' || ownerRole === 'vip+' || ownerRole === 'vip++';
    }
    return false;
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const paginatedVideos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const paginatedIds = paginatedVideos.map(v => v.id);
  const isAllPageSelected = paginatedIds.length > 0 && paginatedIds.every(id => selectedVideos.includes(id));

  const toggleSelect = (id: string) => {
    setSelectedVideos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedVideos(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      setSelectedVideos(prev => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  const startEdit = (video: any) => {
    setEditingVideoId(video.id);
    setEditVisibility(video.visibility);
    setEditCategories([...video.categories]);
  };

  const handleSaveEdit = () => {
    if (editingVideoId) {
      updateVideo(editingVideoId, { visibility: editVisibility, categories: editCategories });
      setEditingVideoId(null);
      showToast('Video updated', 'success');
    }
  };

  const handleBulkUpdate = () => {
    if (selectedVideos.length === 0) return;
    selectedVideos.forEach(id => {
      const updates: any = {};
      if (bulkVisibility) updates.visibility = bulkVisibility;
      
      const v = videos.find(x => x.id === id);
      if (v) {
        let cats = [...(v.categories || [])];
        let hasCategoryChange = false;

        if (bulkCategory) {
          cats = [bulkCategory, ...cats.filter(c => c !== bulkCategory)];
          hasCategoryChange = true;
        }

        if (bulkSubcategory) {
          if (!cats.includes(bulkSubcategory)) {
            cats.push(bulkSubcategory);
          }
          hasCategoryChange = true;
        }

        if (hasCategoryChange) {
          updates.categories = cats;
        }
      }
      
      if (Object.keys(updates).length > 0) updateVideo(id, updates);
    });
    setSelectedVideos([]);
    setBulkVisibility('');
    setBulkCategory('');
    setBulkSubcategory('');
    setShowBulkActions(false);
    showToast(`Updated ${selectedVideos.length} videos`, 'success');
  };

  const visibilityIcon = (vis: string) => {
    switch (vis) {
      case 'public': return <Globe size={12} className="text-green-600" />;
      case 'unlisted': return <EyeOff size={12} className="text-yellow-600" />;
      case 'private': return <Eye size={12} className="text-red-600" />;
      default: return <Shield size={12} className="text-purple-600" />;
    }
  };

  const inputCls = "text-xs border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-200 dark:border-dark-border-light">
        <div className="relative flex-1 max-w-md w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search videos by title or channel..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-dark-elevated border-none rounded-lg text-sm focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* Small text next to the search bar above the show amount option */}
          <div className="flex flex-col items-end gap-0.5 text-xs text-gray-500 dark:text-dark-text-muted">
            <span className="font-semibold text-[11px]">Page {currentPage} of {totalPages || 1}</span>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-gray-400">Show:</span>
              {[30, 50, 100].map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setItemsPerPage(amount);
                    setCurrentPage(1);
                  }}
                  className={`px-1.5 py-0.5 rounded hover:text-red-500 transition font-bold ${
                    itemsPerPage === amount 
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' 
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>

          {selectedVideos.length > 0 && (
            <button 
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2"
            >
              Bulk Actions ({selectedVideos.length})
            </button>
          )}
        </div>
      </div>

      {/* Duplicate Pagination Selection under Search */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-2.5 bg-gray-50 dark:bg-dark-elevated rounded-xl border border-gray-200 dark:border-dark-border-light text-sm">
          <div className="text-gray-500 dark:text-dark-text-muted text-xs">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} total videos
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded text-xs font-medium dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-dark-hover"
            >
              Previous
            </button>
            {(() => {
              const pageNumArr = [];
              const maxVisiblePages = 5;
              let startPage = Math.max(1, currentPage - 2);
              let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
              if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }
              for (let i = startPage; i <= endPage; i++) {
                pageNumArr.push(i);
              }
              return pageNumArr.map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 rounded text-xs font-medium ${currentPage === pageNum ? 'bg-red-600 text-white' : 'bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-hover'}`}
                >
                  {pageNum}
                </button>
              ));
            })()}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded text-xs font-medium dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-dark-hover"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showBulkActions && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 flex flex-wrap items-end gap-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">Set Visibility</label>
            <select value={bulkVisibility} onChange={(e) => setBulkVisibility(e.target.value)} className={inputCls}>
              <option value="">No change</option>
              {getAllowedVisibility('admin').map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">Set Primary Category</label>
            <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className={inputCls}>
              <option value="">No change</option>
              {categories.map(c => <option key={c.id} value={c.name}>{language === 'el' ? c.nameEl : c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">Add Subcategory</label>
            <select value={bulkSubcategory} onChange={(e) => setBulkSubcategory(e.target.value)} className={inputCls}>
              <option value="">No change</option>
              {categories.map(c => <option key={c.id} value={c.name}>{language === 'el' ? c.nameEl : c.name}</option>)}
            </select>
          </div>
          <button onClick={handleBulkUpdate} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 uppercase">Apply to {selectedVideos.length} items</button>
          <button onClick={() => setShowBulkActions(false)} className="px-4 py-1.5 bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text rounded-lg text-xs font-bold hover:bg-gray-300 uppercase">Cancel</button>
        </div>
      )}

      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border-light">
              <th className="px-4 py-3 w-10">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-red-600">
                  {isAllPageSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-gray-500 tracking-wider">Video</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-gray-500 tracking-wider">Stats</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-gray-500 tracking-wider">Visibility</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-gray-500 tracking-wider">Categories</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-gray-500 tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {paginatedVideos.map(video => (
              <tr key={video.id} className={`${selectedVideos.includes(video.id) ? 'bg-red-50/50 dark:bg-red-900/5' : 'hover:bg-gray-50 dark:hover:bg-dark-hover'} transition`}>
                <td className="px-4 py-3">
                  <button onClick={() => toggleSelect(video.id)} className={`${selectedVideos.includes(video.id) ? 'text-red-600' : 'text-gray-300'}`}>
                    {selectedVideos.includes(video.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 items-center">
                    <div className="w-20 aspect-video bg-gray-100 dark:bg-dark-elevated rounded overflow-hidden flex-shrink-0">
                      {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium dark:text-dark-text truncate max-w-[200px]">{video.title}</p>
                      <p className="text-[10px] text-gray-500 dark:text-dark-text-muted mt-0.5">{video.channelName} • {timeAgo(video.uploadDate)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                   <div className="text-[10px] text-gray-500 space-y-0.5">
                     <p>{formatViews(video.views)} views</p>
                     <p>{video.likes} likes</p>
                   </div>
                </td>
                <td className="px-4 py-3">
                  {editingVideoId === video.id ? (
                    <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)} className={inputCls}>
                      {getAllowedVisibility('admin').map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-dark-hover rounded-full">
                      {visibilityIcon(video.visibility)} {video.visibility.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                   {editingVideoId === video.id ? (
                      <div className="relative">
                         <button onClick={() => setShowCategoryPicker(!showCategoryPicker)} className={inputCls + " w-full flex justify-between gap-2"}>
                            <span>{editCategories.length} selected</span>
                            <Plus size={10} />
                         </button>
                         {showCategoryPicker && (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setShowCategoryPicker(false)} />
                              <div className="absolute z-[70] bottom-full mb-1 w-48 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                 {categories.map(c => {
                                   const active = editCategories.includes(c.name);
                                   return (
                                     <button key={c.id} onClick={() => {
                                       setEditCategories(prev => active ? (prev.length > 1 ? prev.filter(x => x !== c.name) : prev) : [...prev, c.name]);
                                     }} className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-dark-hover ${active ? 'bg-red-50 text-red-600' : ''}`}>
                                        {language === 'el' ? c.nameEl : c.name}
                                     </button>
                                   );
                                 })}
                              </div>
                            </>
                         )}
                      </div>
                   ) : (
                     <div className="flex flex-wrap gap-1">
                       {video.categories.map(c => (
                         <span key={c} className="text-[9px] bg-red-100/50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
                           {categories.find(cat => cat.name === c)?.name || c}
                         </span>
                       ))}
                     </div>
                   )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex justify-end gap-1">
                    {editingVideoId === video.id ? (
                      <>
                        <button onClick={handleSaveEdit} className="p-1 px-2 bg-green-600 text-white rounded text-[10px] font-bold uppercase"><Check size={14} /></button>
                        <button onClick={() => setEditingVideoId(null)} className="p-1 px-2 bg-gray-500 text-white rounded text-[10px] font-bold uppercase"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(video)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-500 rounded"><Edit3 size={14} /></button>
                        <button onClick={async () => {
                          const ok = await confirmDialog({ title: 'Delete Video', message: `Are you sure you want to delete "${video.title}"?`, confirmText: 'Delete', danger: true });
                          if (ok) deleteVideo(video.id);
                        }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded"><Trash2 size={14} /></button>
                        <a href={`/watch/${video.id}`} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-500 rounded"><Film size={14} /></a>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-gray-50 dark:bg-dark-elevated border-t border-gray-200 dark:border-dark-border-light text-sm">
            <div className="text-gray-500 dark:text-dark-text-muted">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} total videos
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded text-xs font-medium dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-dark-hover"
              >
                Previous
              </button>
              {(() => {
                const pageNumArr = [];
                const maxVisiblePages = 5;
                let startPage = Math.max(1, currentPage - 2);
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                if (endPage - startPage < maxVisiblePages - 1) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                for (let i = startPage; i <= endPage; i++) {
                  pageNumArr.push(i);
                }
                return pageNumArr.map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded text-xs font-medium ${currentPage === pageNum ? 'bg-red-600 text-white' : 'bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-hover'}`}
                  >
                    {pageNum}
                  </button>
                ));
              })()}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded text-xs font-medium dark:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-dark-hover"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 dark:text-dark-text-muted">
            <Film size={48} className="mx-auto mb-2 opacity-20" />
            <p>No videos found matching your search</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryManagementPanel() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const categories = useStore((s) => s.categories);
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const [newCatName, setNewCatName] = useState('');
  const [newCatNameEl, setNewCatNameEl] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatNameEl, setEditCatNameEl] = useState('');

  const handleAddCategory = () => {
    if (newCatName.trim() && newCatNameEl.trim()) {
      addCategory(newCatName.trim(), newCatNameEl.trim());
      setNewCatName('');
      setNewCatNameEl('');
      showToast('Category created', 'success');
    }
  };

  const startEditCategory = (cat: typeof categories[number]) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatNameEl(cat.nameEl);
  };

  const handleUpdateCategory = () => {
    if (editingCatId && editCatName.trim() && editCatNameEl.trim()) {
      updateCategory(editingCatId, editCatName.trim(), editCatNameEl.trim());
      setEditingCatId(null);
      showToast('Category updated', 'success');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const ok = await confirmDialog({ title: t('delete'), message: t('confirmDeleteCategory'), confirmText: t('delete'), danger: true });
    if (ok) {
      deleteCategory(catId);
      showToast('Category deleted', 'success');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-4">
        <h3 className="font-medium mb-3 dark:text-dark-text">{t('addCategory')}</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-dark-text-muted block mb-1">English</label>
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Category name (EN)" className="w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-dark-text-muted block mb-1">Ελληνικά</label>
            <input value={newCatNameEl} onChange={(e) => setNewCatNameEl(e.target.value)} placeholder="Όνομα κατηγορίας (EL)" className="w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <button onClick={handleAddCategory} disabled={!newCatName.trim() || !newCatNameEl.trim()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 self-end"><Plus size={16} /> {t('add')}</button>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-3 bg-gray-50 dark:bg-dark-elevated text-sm font-medium text-gray-600 dark:text-dark-text-secondary border-b border-gray-200 dark:border-dark-border-light">
          <div>English</div>
          <div>Ελληνικά</div>
          <div>{t('actions')}</div>
        </div>
        {categories.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-dark-text-muted">{t('noCategoriesYet')}</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {categories.map((cat) => (
              <div key={cat.id} className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-3 items-center">
                {editingCatId === cat.id ? (
                  <>
                    <input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} className="border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                    <input value={editCatNameEl} onChange={(e) => setEditCatNameEl(e.target.value)} className="border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                    <div className="flex gap-1">
                      <button onClick={handleUpdateCategory} className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 rounded"><Check size={16} /></button>
                      <button onClick={() => setEditingCatId(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-500 dark:text-dark-text-muted rounded"><X size={16} /></button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm dark:text-dark-text">{cat.name}</div>
                    <div className="text-sm dark:text-dark-text">{cat.nameEl}</div>
                    <div className="flex gap-1">
                      <button onClick={() => startEditCategory(cat)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-500 dark:text-dark-text-muted rounded"><Edit3 size={14} /></button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 rounded"><Trash2 size={14} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserManagementPanel() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const channels = useStore((s) => s.channels);
  const currentUser = useStore((s) => s.currentUser);
  const updateUserRole = useStore((s) => s.updateUserRole);
  const fetchGlobalData = async () => {
    try {
      const data = await api.getChannels();
      if (data) {
        useStore.setState({ channels: data });
      }
    } catch (err: any) {
      console.error('Failed to fetch global channel data', err);
    }
  };
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [muteDays, setMuteDays] = useState<Record<string, number>>({});
  const [banDays, setBanDays] = useState<Record<string, number>>({});
  const [banReason, setBanReason] = useState<Record<string, string>>({});
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);



  const filteredChannels = channels.filter((channel) => {
    const role = channel.role || 'user';
    const email = (channel.email || '').toLowerCase();
    const username = (channel.username || '').toLowerCase();
    const name = (channel.name || '').toLowerCase();
    
    const query = search.toLowerCase();
    const matchesSearch = email.includes(query) || username.includes(query) || name.includes(query);
    const matchesRole = roleFilter === 'all' || role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl overflow-hidden">
      {/* Filtering & Grouping Controls */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-border-light bg-gray-50/50 dark:bg-dark-elevated/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Search users by name, username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
          />
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <span className="text-xs text-gray-500 dark:text-dark-text-muted shrink-0">Filter by Group/Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white w-full sm:w-auto font-medium"
          >
            <option value="all">All Groups / Roles</option>
            <option value="user">User</option>
            <option value="vip">VIP</option>
            <option value="vip+">VIP+</option>
            <option value="vip++">VIP++</option>
            <option value="moderator">Mod</option>
            <option value="moderator_vip_plus">Mod+</option>
            <option value="moderator_vip_plus_plus">Mod++</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 bg-gray-50 dark:bg-dark-elevated text-sm font-medium text-gray-600 dark:text-dark-text-secondary border-b border-gray-200 dark:border-dark-border-light">
        <div></div><div>{t('user')}</div><div>{t('role')}</div><div>{t('actions')}</div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-dark-border">
        {filteredChannels.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-dark-text-muted">No users found matching the selected filters.</div>
        ) : (
          filteredChannels.map((channel) => {
            const role = channel.role || 'user';
            const email = channel.email || 'No Email';
            const username = channel.username || 'no-username';
            const isProtectedRole = role === 'admin' || role === 'moderator' || role === 'moderator_vip_plus' || role === 'moderator_vip_plus_plus';
            return (
              <div key={channel.id} className="border-b border-gray-150 dark:border-dark-border p-1">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-center">
                  <Avatar name={channel.name} src={channel.avatar} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium dark:text-dark-text">{channel.name}</p>
                      {channel.mutedUntil && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono font-bold" title={`Muted until ${channel.mutedUntil}`}>MUTED</span>
                      )}
                      {channel.banned && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">BANNED</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-dark-text-muted">@{username} • {email}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(role)}`}>
                    {getRoleIcon(role)} {role === 'admin' ? (channel.id === 'ch-admin' ? 'MAIN ADMIN' : 'PROMOTED ADMIN') : getRoleLabel(role).toUpperCase()}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end items-center">
                    <button
                      onClick={() => setHistoryUserId(channel.id)}
                      className="p-1 rounded text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                      title="View Moderation Profile / History"
                    >
                      <History size={16} />
                    </button>

                    {channel.id !== currentUser.id && channel.id !== 'ch-admin' && (
                      <button
                        onClick={() => setExpandedUserId(expandedUserId === channel.id ? null : channel.id)}
                        className={`p-1 rounded transition ${
                          expandedUserId === channel.id ? 'bg-red-50 text-red-600 dark:bg-red-950/40' : 'text-slate-400 hover:text-slate-600 dark:text-dark-text-muted'
                        }`}
                        title="Moderate User (Mute / Ban)"
                      >
                        <Shield size={16} />
                      </button>
                    )}

                    {channel.id !== currentUser.id ? (
                      channel.id === 'ch-admin' ? (
                        <span className="text-xs text-gray-400 dark:text-dark-text-muted italic">
                          MAIN ADMIN (Protected)
                        </span>
                      ) : currentUser.role === 'admin' ? (
                        <select
                          value={role}
                          onChange={(e) => {
                            updateUserRole(channel.id, e.target.value as any);
                            showToast(`Updated role for ${channel.name} to ${e.target.value.toUpperCase()}`, 'success');
                          }}
                          className="text-xs border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                        >
                          {isProtectedRole && (
                            <option value={role} disabled>{getRoleLabel(role)} (Use dedicated promote panel)</option>
                          )}
                          <option value="user">User</option>
                          <option value="vip">VIP</option>
                          <option value="vip+">VIP+</option>
                          <option value="vip++">VIP++</option>
                        </select>
                      ) : isProtectedRole ? (
                        <span className="text-xs text-gray-400 dark:text-dark-text-muted italic">
                          {role === 'admin' ? 'PROMOTED ADMIN' : `${getRoleLabel(role).toUpperCase()} (Protected)`}
                        </span>
                      ) : (currentUser.role === 'moderator' || currentUser.role === 'moderator_vip_plus' || currentUser.role === 'moderator_vip_plus_plus') ? (
                        (() => {
                          const allowed: Record<string, string[]> = {
                            moderator: ['user', 'vip'],
                            moderator_vip_plus: ['user', 'vip', 'vip+'],
                            moderator_vip_plus_plus: ['user', 'vip', 'vip+', 'vip++']
                          };
                          const callerRole = currentUser.role;
                          const isOwnerRoleAllowed = allowed[callerRole]?.includes(role);
                          if (!isOwnerRoleAllowed) {
                            return <span className="text-xs text-gray-400 dark:text-dark-text-muted italic">Restricted</span>;
                          }
                          return (
                            <select
                              value={role}
                              onChange={(e) => {
                                updateUserRole(channel.id, e.target.value as any);
                                showToast(`Updated role for ${channel.name} to ${e.target.value.toUpperCase()}`, 'success');
                              }}
                              className="text-xs border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                            >
                              <option value="user">User</option>
                              <option value="vip">VIP</option>
                              {callerRole !== 'moderator' && <option value="vip+">VIP+</option>}
                              {callerRole === 'moderator_vip_plus_plus' && <option value="vip++">VIP++</option>}
                            </select>
                          );
                        })()
                      ) : (
                        <select
                          value={role}
                          onChange={(e) => {
                            updateUserRole(channel.id, e.target.value as any);
                            showToast(`Updated role for ${channel.name} to ${e.target.value.toUpperCase()}`, 'success');
                          }}
                          className="text-xs border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                        >
                          <option value="user">User</option>
                          <option value="vip">VIP</option>
                          <option value="vip+">VIP+</option>
                          <option value="vip++">VIP++</option>
                        </select>
                      )
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-dark-text-muted italic">Self ({currentUser.role.toUpperCase()})</span>
                    )}
                  </div>
                </div>

                {/* EXPANDABLE INLINE DRAWER MODERATION OPTIONS */}
                {expandedUserId === channel.id && (
                  <div className="mx-4 my-2 p-4 bg-slate-50 dark:bg-dark-hover/30 rounded-lg border border-dashed border-gray-200 dark:border-dark-border space-y-4 text-xs">
                    <div className="flex flex-col md:flex-row gap-6 justify-between items-stretch">
                      {/* Mute Box Section */}
                      <div className="flex-1 space-y-2 border-r border-gray-150 pr-0 md:pr-4 dark:border-dark-border">
                        <h5 className="font-bold text-gray-700 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                          <VolumeX size={14} className="text-amber-500" /> Session Mute Config
                        </h5>
                        <p className="text-[10px] text-gray-400 leading-normal">
                          Configurable mute limits comment, video, and playlist creation.
                        </p>
                        {channel.mutedUntil ? (
                          <div className="space-y-2 pt-1">
                            <div className="p-2 bg-amber-100/60 text-amber-800 rounded font-semibold text-center">
                              Active Mute expires: {new Date(channel.mutedUntil).toLocaleDateString()}
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  await api.unmuteUser(channel.id);
                                  showToast(`Mute removed. ${channel.name} has been unmuted.`, 'success');
                                  await fetchGlobalData();
                                } catch (err: any) {
                                  showToast(err.message || 'Failed to unmute', 'error');
                                }
                              }}
                              className="w-full py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded uppercase transition"
                            >
                              Unmute User Now
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Mute Limit (Days):</span>
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={muteDays[channel.id] || 7}
                                onChange={(e) => setMuteDays({ ...muteDays, [channel.id]: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-14 border border-gray-200 dark:border-dark-border dark:bg-dark-input rounded px-2 py-1 text-center font-bold"
                              />
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const days = muteDays[channel.id] || 7;
                                  await api.muteUser(channel.id, days);
                                  showToast(`Channel ${channel.name} muted for ${days} days.`, 'success');
                                  await fetchGlobalData();
                                } catch (err: any) {
                                  showToast(err.message || 'Mute failed', 'error');
                                }
                              }}
                              className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded uppercase transition"
                            >
                              Silence Channel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Ban / Forward Section */}
                      <div className="flex-1 space-y-2 pl-0 md:pl-2">
                        <h5 className="font-bold text-gray-700 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                          <Ban size={14} className="text-red-500" /> Platform Account Ban
                        </h5>
                        <p className="text-[10px] text-gray-400 leading-normal">
                          Prevents login, updates blacklisted email & profile data.
                        </p>
                        {currentUser.role === 'admin' ? (
                          channel.banned ? (
                            <div className="space-y-2 pt-1">
                              <div className="p-2 bg-red-100/60 text-red-800 rounded font-semibold text-center">
                                Terminated & Blacklisted
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    await api.unbanUser(channel.id);
                                    showToast(`${channel.name} unbanned. Blacklist lifted successfully!`, 'success');
                                    await fetchGlobalData();
                                  } catch (err: any) {
                                    showToast(err.message || 'Failed to unban', 'error');
                                  }
                                }}
                                className="w-full py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded uppercase transition"
                              >
                                Revoke Ban & White-list
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2 pt-1">
                              <div className="grid grid-cols-[1fr_auto] gap-2">
                                <input
                                  type="text"
                                  placeholder="Specify ban reason transcript..."
                                  value={banReason[channel.id] || ''}
                                  onChange={(e) => setBanReason({ ...banReason, [channel.id]: e.target.value })}
                                  className="border border-gray-200 dark:border-dark-border dark:bg-dark-input rounded px-2 py-1"
                                />
                                <input
                                  type="number"
                                  placeholder="Days"
                                  min={1}
                                  value={banDays[channel.id] || 30}
                                  onChange={(e) => setBanDays({ ...banDays, [channel.id]: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="w-12 border border-gray-200 dark:border-dark-border dark:bg-dark-input rounded text-center"
                                />
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    const days = banDays[channel.id] || 30;
                                    const rsn = banReason[channel.id] || 'Violated terms';
                                    await api.banUser(channel.id, days, rsn);
                                    showToast(`Channel ${channel.name} banned! Credentials blacklisted.`, 'success');
                                    await fetchGlobalData();
                                  } catch (err: any) {
                                    showToast(err.message || 'Ban failed', 'error');
                                  }
                                }}
                                className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded uppercase transition"
                              >
                                Commit Account Termination
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="pt-2">
                            <button
                              onClick={async () => {
                                try {
                                  await api.submitReport(
                                    'ban_request',
                                    channel.id,
                                    'Mod Forwarded Ban Appeal',
                                    'Escalated to Administrators list due to verified Terms of Service violations.'
                                  );
                                  showToast(`Escalated case file for ${channel.name} to Admin panel successfully!`, 'success');
                                  setExpandedUserId(null);
                                } catch (err: any) {
                                  showToast(err.message || 'Failed to forward ban request file', 'error');
                                }
                              }}
                              className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded uppercase tracking-wider transition shadow-sm"
                            >
                              Forward Case to Administrator
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {historyUserId && (
        <UserModerationHistoryModal
          userId={historyUserId}
          onClose={() => setHistoryUserId(null)}
        />
      )}
    </div>
  );
}

function AdminUserSection() {
  const { showToast } = useToast();
  const channels = useStore((s) => s.channels);
  const currentUser = useStore((s) => s.currentUser);
  const updateUserRole = useStore((s) => s.updateUserRole);
  const [adminSearch, setAdminSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  
  const [modSearch, setModSearch] = useState('');
  const [selectedModUser, setSelectedModUser] = useState<string>('');
  const [targetModRole, setTargetModRole] = useState<'moderator' | 'moderator_vip_plus' | 'moderator_vip_plus_plus'>('moderator');

  const handlePromoteLink = () => {
    if (selectedUser) {
        updateUserRole(selectedUser, 'admin');
        setSelectedUser('');
        setAdminSearch('');
        showToast('User promoted to Admin', 'success');
    }
  }

  const selectedModChannel = channels.find(c => c.id === selectedModUser);

  const handlePromoteMod = () => {
    if (selectedModUser && selectedModChannel) {
        const roleLabel = getRoleLabel(targetModRole);
        
        updateUserRole(selectedModUser, targetModRole);
        setSelectedModUser('');
        setModSearch('');
        showToast(`${selectedModChannel.name} role updated to ${roleLabel}`, 'success');
    }
  }

  const filteredUsers = channels.filter(c => {
    const role = c.role || 'user';
    if (role === 'admin') return false;
    const email = (c.email || '').toLowerCase();
    const username = (c.username || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const query = adminSearch.toLowerCase();
    return email.includes(query) || username.includes(query) || name.includes(query);
  }).slice(0, 5);

  const filteredModUsers = channels.filter(c => {
    if (c.id === 'ch-admin') return false;
    if (c.id === currentUser.id) return false;
    const email = (c.email || '').toLowerCase();
    const username = (c.username || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const query = modSearch.toLowerCase();
    return email.includes(query) || username.includes(query) || name.includes(query);
  }).slice(0, 5);

  return (
    <div className="space-y-6">
       {currentUser.role === 'admin' && (
         <>
           <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white"><Shield size={20} className="text-red-500" /> Add New Administrator</h3>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-4">Promote an existing user to Administrator. Administrators have full access to all features and content.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search user by name, email or username..." 
                    value={adminSearch}
                    onChange={(e) => {setAdminSearch(e.target.value); setSelectedUser('');}}
                    className="w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all shadow-sm"
                  />
                  {adminSearch.length > 1 && !selectedUser && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-lg shadow-xl overflow-hidden divide-y divide-gray-100 dark:divide-dark-border">
                      {filteredUsers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No users found</div>
                      ) : (
                        filteredUsers.map(u => (
                          <button key={u.id} onClick={() => { setSelectedUser(u.id); setAdminSearch(`${u.name} (@${u.username})`); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={u.name} src={u.avatar} size="sm" />
                              <div className="text-left">
                                <p className="text-sm font-medium dark:text-dark-text">{u.name}</p>
                                <p className="text-xs text-gray-500">@{u.username} • {u.email}</p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(u.role || 'user')}`}>
                              {getRoleIcon(u.role || 'user')} {getRoleLabel(u.role || 'user').toUpperCase()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button 
                  onClick={handlePromoteLink}
                  disabled={!selectedUser}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed uppercase shadow-md shadow-red-500/20"
                >
                  Promote to Admin
                </button>
              </div>
           </div>

           <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white"><Shield size={20} className="text-blue-500" /> Moderator Configurations</h3>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-4">Manage Moderator roles. Assign user as Mod, Mod+, or Mod++, allowing them to moderate content for their corresponding groups (standard users, VIPs, or VIP+ and VIP++ users).</p>
              
              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-4">

                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search user by name, email or username..." 
                    value={modSearch}
                    onChange={(e) => {setModSearch(e.target.value); setSelectedModUser('');}}
                    className="w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                  />
                  {modSearch.length > 1 && !selectedModUser && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-lg shadow-xl overflow-hidden divide-y divide-gray-100 dark:divide-dark-border">
                      {filteredModUsers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No users found</div>
                      ) : (
                        filteredModUsers.map(u => (
                          <button key={u.id} onClick={() => { setSelectedModUser(u.id); setModSearch(`${u.name} (@${u.username})`); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={u.name} src={u.avatar} size="sm" />
                              <div className="text-left">
                                <p className="text-sm font-medium dark:text-dark-text">{u.name}</p>
                                <p className="text-xs text-gray-500">@{u.username} • {u.email} </p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(u.role || 'user')}`}>
                              {getRoleIcon(u.role || 'user')} {getRoleLabel(u.role || 'user').toUpperCase()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                   <select
                     value={targetModRole}
                     onChange={(e) => setTargetModRole(e.target.value as any)}
                     className="w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white"
                   >
                     <option value="moderator">Mod (Can moderate standard users & VIPs)</option>
                     <option value="moderator_vip_plus">Mod+ (Can moderate up to VIP+ channels)</option>
                     <option value="moderator_vip_plus_plus">Mod++ (Can moderate up to VIP++ channels)</option>
                     
                   </select>
                 </div>
                 <button 
                   onClick={handlePromoteMod}
                   disabled={!selectedModUser}
                   className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed uppercase shadow-md shadow-blue-500/20"
                 >
                   {selectedModChannel 
                     ? (selectedModChannel.role === targetModRole
                         ? `Already ${getRoleLabel(targetModRole).toUpperCase()}`
                         : `Set to ${getRoleLabel(targetModRole).toUpperCase()}`)
                     : `Set to ${getRoleLabel(targetModRole).toUpperCase()}`}
                 </button>
              </div>
           </div>
         </>
       )}

       <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white"><Users size={20} className="text-gray-500" /> All Registered Users</h3>
          <UserManagementPanel />
       </div>
    </div>
  );
}

export default function AdminPage() {
  const currentUser = useStore((s) => s.currentUser);
  const channels = useStore((s) => s.channels);
  const videos = useStore((s) => s.videos);
  const categories = useStore((s) => s.categories);
  const notifications = useStore((s) => s.notifications);
  const [section, setSection] = useState<AdminSection>('overview');

  const isModeratorRole = currentUser.role === 'moderator' || currentUser.role === 'moderator_vip_plus' || currentUser.role === 'moderator_vip_plus_plus';

  if (currentUser.role !== 'admin' && !isModeratorRole) return <Navigate to="/" replace />;

  const cards = useMemo(() => [
    { label: 'Users', value: channels.length, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Videos', value: videos.length, icon: Film, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Categories', value: categories.length, icon: FolderTree, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Notifications', value: notifications.length, icon: Bell, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ], [channels.length, videos.length, categories.length, notifications.length]);

  const groups = [
    {
      title: 'Main',
      items: [{ key: 'overview', label: isModeratorRole ? 'Moderator Panel' : 'Admin Panel', icon: LayoutDashboard }],
    },
    {
      title: 'User Moderation',
      items: [
        { key: 'users', label: 'Users', icon: Users },
        { key: 'recovery', label: 'Recovery Requests', icon: KeyRound },
        { key: 'reports', label: 'Reported Content', icon: Flag },
      ],
    },
    {
      title: 'Video Management',
      items: [
        { key: 'videos', label: 'All Videos', icon: Film },
        { key: 'categories', label: 'Category Management', icon: FolderTree },
        ...(currentUser.role === 'admin' ? [{ key: 'import', label: 'Import Videos', icon: Film }] : []),
      ],
    },
    ...(currentUser.role === 'admin' ? [{
      title: 'Server',
      items: [
        { key: 'backups', label: 'Backup & Recovery', icon: Database },
        { key: 'health', label: 'System Health & Tools', icon: Shield },
      ],
    }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={28} className="text-red-600 dark:text-red-500" />
        <div>
          <h1 className="text-2xl font-bold dark:text-dark-text">{isModeratorRole ? 'Moderator Panel' : 'Admin Panel'}</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">Central place for users, videos, imports, and server snapshots</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left nav */}
        <aside className="lg:w-72 flex-shrink-0">
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-2xl p-3 sticky top-20 space-y-4">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="px-3 py-1 text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-text-muted font-semibold">{group.title}</p>
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => {
                    const active = section === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setSection(item.key as AdminSection)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                          active
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium'
                            : 'hover:bg-gray-50 dark:hover:bg-dark-hover text-gray-700 dark:text-dark-text-secondary'
                        }`}
                      >
                        <span className="flex items-center gap-3"><item.icon size={17} /> {item.label}</span>
                        <ChevronRight size={15} className="opacity-50" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <section className="flex-1 min-w-0">
          {section === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => (
                  <div key={card.label} className={`${card.bg} rounded-xl p-4`}>
                    <card.icon size={20} className={card.color} />
                    <p className="text-2xl font-bold mt-2">{card.value}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-0.5">{card.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => setSection('users')} className="text-left bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 hover:shadow-md transition">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Users size={18} /> User Management</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-muted">Promote users, grant VIP, and handle recovery requests.</p>
                </button>
                <button onClick={() => setSection(currentUser.role === 'admin' ? 'import' : 'categories')} className="text-left bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 hover:shadow-md transition">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Film size={18} /> Video Management</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-muted">
                    {currentUser.role === 'admin'
                      ? 'Manage categories and import videos from mounted drives.'
                      : 'Manage video categories.'}
                  </p>
                </button>
                {currentUser.role === 'admin' && (
                  <>
                    <button onClick={() => setSection('backups')} className="text-left bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 hover:shadow-md transition">
                      <h3 className="font-semibold mb-2 flex items-center gap-2"><Database size={18} /> Server Related</h3>
                      <p className="text-sm text-gray-500 dark:text-dark-text-muted">Create backups, restore databases, and inspect storage usage.</p>
                    </button>
                    <button onClick={() => setSection('health')} className="text-left bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 hover:shadow-md transition">
                      <h3 className="font-semibold mb-2 flex items-center gap-2"><Shield size={18} /> System diagnostics & logs</h3>
                      <p className="text-sm text-gray-500 dark:text-dark-text-muted">Deep hardware health checklists, real operations logs and storage cleaning purgers.</p>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {section === 'users' && <AdminUserSection />}
          {section === 'videos' && <VideoManagementPanel />}
          {section === 'recovery' && <RecoveryRequestsPage />}
          {section === 'categories' && <CategoryManagementPanel />}
          {section === 'import' && <ImportPage />}
          {section === 'backups' && <BackupPage />}
          {section === 'health' && <SystemHealthSection />}
          {section === 'reports' && <ReportsManagementPanel />}
        </section>
      </div>
    </div>
  );
}
