import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Database, Download, Upload, Trash2, HardDrive, RefreshCw, Shield, Clock } from 'lucide-react';
import useStore from '../store/useStore';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

interface BackupFile { name: string; size: number; date: string; }
interface StorageInfo { database: number; videos: number; thumbnails: number; avatars: number; banners: number; backups: number; videoCount: number; userCount: number; }

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function BackupPage() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const currentUser = useStore((s) => s.currentUser);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (currentUser.role !== 'admin') return <Navigate to="/" replace />;

  const load = async () => {
    setLoading(true);
    try {
      const { api } = await import('../api/client');
      const [b, s] = await Promise.all([api.getBackups(), api.getStorage()]);
      setBackups(b);
      setStorage(s);
    } catch (err: any) { showToast(err.message || 'Failed to load', 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { api } = await import('../api/client');
      const b = await api.createBackup();
      setBackups((prev) => [b, ...prev]);
      showToast('Backup created successfully', 'success');
    } catch (err: any) { showToast(err.message || 'Backup failed', 'error'); }
    setCreating(false);
  };

  const handleDelete = async (name: string) => {
    const ok = await confirm({ title: 'Delete Backup', message: `Delete "${name}"? This cannot be undone.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      const { api } = await import('../api/client');
      await api.deleteBackup(name);
      setBackups((prev) => prev.filter((b) => b.name !== name));
      showToast('Backup deleted', 'success');
    } catch (err: any) { showToast(err.message || 'Delete failed', 'error'); }
  };

  const handleRestore = async (file: File) => {
    const ok = await confirm({
      title: 'Restore Database',
      message: 'This will REPLACE your entire database with the uploaded file. A safety backup of the current database will be created first. The server may need to be restarted.',
      confirmText: 'Restore',
      danger: true,
    });
    if (!ok) return;
    setRestoring(true);
    try {
      const { api } = await import('../api/client');
      const formData = new FormData();
      formData.append('backup', file);
      const result = await api.restoreBackup(formData);
      showToast(result.message || 'Database restored', 'success');
      await load();
    } catch (err: any) { showToast(err.message || 'Restore failed', 'error'); }
    setRestoring(false);
  };

  const [downloadingName, setDownloadingName] = useState<string | null>(null);
  const [downloadingDb, setDownloadingDb] = useState(false);

  const handleDownloadBackup = async (name: string) => {
    setDownloadingName(name);
    try {
      const { api } = await import('../api/client');
      const blob = await api.downloadBackup(name);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Download started successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Download failed', 'error');
    } finally {
      setDownloadingName(null);
    }
  };

  const handleDownloadLiveDb = async () => {
    setDownloadingDb(true);
    try {
      const { api } = await import('../api/client');
      const blob = await api.downloadLiveDb();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'viewtube.db';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Download started successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Download failed', 'error');
    } finally {
      setDownloadingDb(false);
    }
  };

  const storageItems = storage ? [
    { label: 'Database', size: storage.database, icon: Database, color: 'text-blue-500' },
    { label: 'Videos', size: storage.videos, icon: HardDrive, color: 'text-purple-500' },
    { label: 'Thumbnails', size: storage.thumbnails, icon: HardDrive, color: 'text-green-500' },
    { label: 'Avatars', size: storage.avatars, icon: HardDrive, color: 'text-orange-500' },
    { label: 'Banners', size: storage.banners, icon: HardDrive, color: 'text-pink-500' },
    { label: 'Backups', size: storage.backups, icon: Clock, color: 'text-gray-500' },
  ] : [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={28} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Backups & Storage</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">Manage database backups and view storage usage</p>
        </div>
      </div>

      {/* Storage overview */}
      {storage && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Storage Usage</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-dark-text-muted">
              <span>{storage.videoCount} videos</span>
              <span>{storage.userCount} users</span>
              <button onClick={load} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-hover rounded" title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {storageItems.map((item) => (
              <div key={item.label} className="bg-gray-50 dark:bg-dark-elevated rounded-lg p-3 text-center">
                <item.icon size={18} className={`mx-auto mb-1 ${item.color}`} />
                <p className="text-sm font-bold">{formatBytes(item.size)}</p>
                <p className="text-[10px] text-gray-500 dark:text-dark-text-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={handleCreate} disabled={creating} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Database size={16} />}
          {creating ? 'Creating...' : 'Create Backup'}
        </button>

        <button onClick={handleDownloadLiveDb} disabled={downloadingDb} className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
          {downloadingDb ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download size={16} />}
          {downloadingDb ? 'Downloading...' : 'Download Live Database'}
        </button>

        <button onClick={() => restoreInputRef.current?.click()} disabled={restoring} className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
          {restoring ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={16} />}
          {restoring ? 'Restoring...' : 'Restore from File'}
        </button>
        <input ref={restoreInputRef} type="file" accept=".db" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleRestore(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {/* Backup list */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border-light flex items-center justify-between">
          <h2 className="font-semibold text-sm">Saved Backups</h2>
          <span className="text-xs text-gray-500 dark:text-dark-text-muted">{backups.length} backups</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400"><div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" /></div>
        ) : backups.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-dark-text-muted">
            <Database size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No backups yet</p>
            <p className="text-xs mt-1">Click "Create Backup" to save a snapshot</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {backups.map((b) => (
              <div key={b.name} className="flex items-center gap-4 px-4 py-3">
                <Database size={18} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate dark:text-dark-text">{b.name}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                    {new Date(b.date).toLocaleString()} • {formatBytes(b.size)}
                  </p>
                </div>
                <button 
                  onClick={() => handleDownloadBackup(b.name)} 
                  disabled={downloadingName === b.name} 
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full disabled:opacity-50" 
                  title="Download"
                >
                  {downloadingName === b.name ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                </button>
                <button onClick={() => handleDelete(b.name)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-elevated rounded-xl text-xs text-gray-500 dark:text-dark-text-muted space-y-1">
        <p>• Backups include the database only (users, videos metadata, playlists, comments, analytics, settings)</p>
        <p>• Video files, thumbnails, avatars, and banners are NOT included in backups — back those up separately</p>
        <p>• Restoring a backup creates a safety snapshot of the current database first</p>
        <p>• After restoring, restart the container for changes to take full effect</p>
      </div>
    </div>
  );
}
