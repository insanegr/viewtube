import { useEffect, useState } from 'react';
import { 
  Activity, Shield, Trash2, Database, RefreshCw, AlertTriangle, 
  CheckCircle2, XCircle, HardDrive, Terminal, FileText, 
  CheckSquare, Square, Search, RefreshCcw, FolderIcon, HelpCircle, FileWarning
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { formatDateTime } from '../utils/format';

export interface AdminLog {
  id: string;
  action: string;
  adminId: string;
  adminName: string;
  adminUsername: string;
  details: string;
  createdAt: string;
}

export interface SystemHealth {
  uptime: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  env: string;
  timeZone: string;
  os: {
    totalMem: number;
    freeMem: number;
    cpus: number;
    cpuModel: string;
    loadAvg: number[];
  };
  processMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  database: {
    integrity: string;
    dbSize: number;
    records: {
      videos: number;
      channels: number;
      playlists: number;
      comments: number;
      subscriptions: number;
      resetRequests: number;
      adminLogs: number;
    };
  };
  directories: {
    name: string;
    path: string;
    exists: boolean;
    writable: boolean;
    size: number;
    fileCount: number;
  }[];
  utilities: {
    ffmpegInstalled: boolean;
    ffprobeInstalled: boolean;
  };
}

export interface OrphanedFile {
  path: string;
  size: number;
  mtime: string;
  type: string;
}

export interface BrokenVideoEntry {
  id: string;
  title: string;
  videoPath: string;
  channelId: string;
}

export interface CleanerScanResults {
  orphanedFiles: OrphanedFile[];
  brokenDbEntries: BrokenVideoEntry[];
  orphansTotalSize: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export default function SystemHealthSection() {
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<'health' | 'logs' | 'cleaner'>('health');
  
  // States
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');

  const [cleanerScan, setCleanerScan] = useState<CleanerScanResults | null>(null);
  const [cleanerLoading, setCleanerLoading] = useState(false);
  const [selectedOrphans, setSelectedOrphans] = useState<string[]>([]);
  const [purgingOrphans, setPurgingOrphans] = useState(false);
  const [repairingDb, setRepairingDb] = useState(false);

  // Fetch Health
  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const { api } = await import('../api/client');
      const data = await api.getSystemHealth();
      setHealthData(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load system health', 'error');
    } finally {
      setHealthLoading(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const { api } = await import('../api/client');
      const data = await api.getAdminLogs();
      setLogs(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load admin logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  // Run Storage Cleaner scan
  const runScan = async () => {
    setCleanerLoading(true);
    try {
      const { api } = await import('../api/client');
      const data = await api.cleanerScan();
      setCleanerScan(data);
      setSelectedOrphans([]); // Reset selection
      showToast('Cleaner storage scans completed successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to scan filesystems', 'error');
    } finally {
      setCleanerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'health') fetchHealth();
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'cleaner' && !cleanerScan) runScan();
  }, [activeTab]);

  // Handle Purging selected orphans
  const handlePurgeOrphans = async () => {
    if (selectedOrphans.length === 0) return;
    const ok = await confirm({
      title: 'Purge Orphaned Files',
      message: `Are you sure you want to permanently delete these ${selectedOrphans.length} file(s) from the server storage? This action is absolutely irreversible.`,
      confirmText: 'Delete Files Permanently',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;

    setPurgingOrphans(true);
    try {
      const { api } = await import('../api/client');
      const result = await api.cleanerPurge(selectedOrphans);
      showToast(`Successfully purged ${result.deletedCount} orphaned files! Reclaimed ${formatBytes(result.bytesReclaimed)}.`, 'success');
      // Update local scan state
      if (cleanerScan) {
        const scanResult = {
          ...cleanerScan,
          orphanedFiles: cleanerScan.orphanedFiles.filter(item => !selectedOrphans.includes(item.path)),
          orphansTotalSize: Math.max(0, cleanerScan.orphansTotalSize - result.bytesReclaimed)
        };
        setCleanerScan(scanResult);
      }
      setSelectedOrphans([]);
    } catch (err: any) {
      showToast(err.message || 'Failed to purge orphaned files', 'error');
    } finally {
      setPurgingOrphans(false);
    }
  };

  // Scan selections
  const toggleSelectOrphan = (filePath: string) => {
    setSelectedOrphans(prev => prev.includes(filePath) ? prev.filter(x => x !== filePath) : [...prev, filePath]);
  };

  const selectAllOrphans = () => {
    if (!cleanerScan) return;
    const allPaths = cleanerScan.orphanedFiles.map(f => f.path);
    if (selectedOrphans.length === allPaths.length) {
      setSelectedOrphans([]);
    } else {
      setSelectedOrphans(allPaths);
    }
  };

  // Repair broken db entries
  const handleRepairDB = async () => {
    if (!cleanerScan || cleanerScan.brokenDbEntries.length === 0) return;
    const videoIds = cleanerScan.brokenDbEntries.map(v => v.id);
    const ok = await confirm({
      title: 'Prune Database Video Entries',
      message: `You are about to delete ${videoIds.length} broken database index entries that refer to local paths that no longer exist on server disk. Related comments, category tags, and history elements for these specific items will be cleanly unmapped. Are you sure?`,
      confirmText: 'Prune Indexes Now',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;

    setRepairingDb(true);
    try {
      const { api } = await import('../api/client');
      const result = await api.cleanerRepairDb(videoIds);
      showToast(`Repaired ${result.repairedCount} video records inside the database.`, 'success');
      // Reset scan state locally
      if (cleanerScan) {
        setCleanerScan({
          ...cleanerScan,
          brokenDbEntries: []
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to prune database records', 'error');
    } finally {
      setRepairingDb(false);
    }
  };

  // Filters logs based on search
  const filteredLogs = logs.filter(log => {
    const rawSearch = logSearch.toLowerCase();
    const action = log.action || '';
    const username = log.adminUsername || '';
    const name = log.adminName || '';
    const details = log.details || '';
    return (
      action.toLowerCase().includes(rawSearch) ||
      username.toLowerCase().includes(rawSearch) ||
      name.toLowerCase().includes(rawSearch) ||
      details.toLowerCase().includes(rawSearch)
    );
  });

  const getLogBadgeClasses = (action: string) => {
    switch (action) {
      case 'ROLE_CHANGE':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30';
      case 'BACKUP_CREATE':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30';
      case 'BACKUP_DELETE':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30';
      case 'BACKUP_RESTORE':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200 dark:border-purple-900/30';
      case 'IMPORT_VIDEOS':
        return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900/30';
      case 'CLEANUP_ORPHANS':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400 border border-teal-200 dark:border-teal-900/30';
      case 'RECOVERY_RESET':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30';
      case 'RECOVERY_DISMISS':
        return 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border border-gray-200 dark:border-gray-900/30';
      default:
        return 'bg-zinc-50 text-zinc-700 dark:bg-zinc-900/20 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-900/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border-light shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-dark-border-light pb-1 sm:pb-0 sm:border-b-0">
          <button 
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'health' 
                ? 'bg-red-600 text-white shadow-md shadow-red-500/10' 
                : 'text-gray-600 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-hover'
            }`}
          >
            <span className="flex items-center gap-1.5"><Activity size={14} /> System Health</span>
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'logs' 
                ? 'bg-red-600 text-white shadow-md shadow-red-500/10' 
                : 'text-gray-600 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-hover'
            }`}
          >
            <span className="flex items-center gap-1.5"><Terminal size={14} /> Operations Logs</span>
          </button>
          <button 
            onClick={() => setActiveTab('cleaner')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'cleaner' 
                ? 'bg-red-600 text-white shadow-md shadow-red-500/10' 
                : 'text-gray-600 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-hover'
            }`}
          >
            <span className="flex items-center gap-1.5"><Trash2 size={14} /> Storage Cleanup</span>
          </button>
        </div>

        <div>
          {activeTab === 'health' && (
            <button 
              onClick={fetchHealth} 
              disabled={healthLoading}
              className="px-3.5 py-1.5 bg-gray-50 dark:bg-dark-elevated hover:bg-gray-100 dark:hover:bg-dark-hover border border-gray-200 dark:border-dark-border shadow-sm text-xs font-semibold text-gray-700 dark:text-dark-text rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={healthLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          )}
          {activeTab === 'logs' && (
            <button 
              onClick={fetchLogs} 
              disabled={logsLoading}
              className="px-3.5 py-1.5 bg-gray-50 dark:bg-dark-elevated hover:bg-gray-100 dark:hover:bg-dark-hover border border-gray-200 dark:border-dark-border shadow-sm text-xs font-semibold text-gray-700 dark:text-dark-text rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={logsLoading ? 'animate-spin' : ''} /> Reload Audit
            </button>
          )}
          {activeTab === 'cleaner' && (
            <button 
              onClick={runScan} 
              disabled={cleanerLoading}
              className="px-3.5 py-1.5 bg-gray-50 dark:bg-dark-elevated hover:bg-gray-100 dark:hover:bg-dark-hover border border-gray-200 dark:border-dark-border shadow-sm text-xs font-semibold text-gray-700 dark:text-dark-text rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCcw size={13} className={cleanerLoading ? 'animate-spin' : ''} /> Rescan System
            </button>
          )}
        </div>
      </div>

      {/* ── HEALTH TAB ── */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {healthLoading && !healthData ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border">
              <RefreshCw size={36} className="text-red-500 animate-spin mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-dark-text-muted">Compiling server diagnostics metrics...</p>
            </div>
          ) : healthData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Core Specs Overview Card */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border-light p-5 space-y-4 shadow-sm md:col-span-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-gray-50 dark:border-dark-border pb-3">
                  <Activity size={16} className="text-red-500" /> Host Application Engine Specs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400">Node JS Runtime</span>
                    <span className="font-mono text-sm font-bold text-gray-800 dark:text-dark-text">{healthData.nodeVersion}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400">System Platform</span>
                    <span className="font-sans text-sm font-bold text-gray-800 dark:text-dark-text capitalize">{healthData.platform} ({healthData.arch})</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400">Environment Profile</span>
                    <span className="text-sm font-bold capitalize text-green-600 dark:text-green-400">{healthData.env}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400">Engine Safe Timezone</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-dark-text">{healthData.timeZone}</span>
                  </div>
                  <div className="sm:col-span-2 border-t border-gray-50 dark:border-dark-border pt-4">
                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Process Hardware CPU model</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-dark-text-muted">{healthData.os.cpuModel}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-block px-1.5 py-0.5 bg-gray-100 dark:bg-dark-hover text-gray-500 rounded text-[9px] font-bold">{healthData.os.cpus} Logical Cores</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-[10px] font-mono text-gray-500">Loads: {healthData.os.loadAvg.map(l => l.toFixed(2)).join(' / ')}</span>
                    </div>
                  </div>
                </div>

                {/* Micro Uptime Panel */}
                <div className="mt-4 p-3 bg-red-50/50 dark:bg-red-950/10 rounded-xl border border-red-100/30 dark:border-red-900/10 flex items-center justify-between">
                  <div className="text-left">
                    <span className="block text-[10px] uppercase font-bold text-red-700 dark:text-red-400">System Uptime</span>
                    <span className="text-sm font-mono font-bold text-red-800 dark:text-red-400">{formatUptime(healthData.uptime)}</span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-gray-500 dark:text-dark-text-muted uppercase">Engine Normal Operation</span>
                  </div>
                </div>
              </div>

              {/* Memory Allocation Card */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border-light p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-gray-50 dark:border-dark-border pb-3">
                    <HardDrive size={16} className="text-indigo-500" /> RAM Memory Allocations
                  </h3>
                  <div className="mt-4 space-y-3">
                    {/* Active container RSS */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 font-medium">Resident Set Size (RSS)</span>
                        <span className="font-mono font-bold text-gray-800 dark:text-dark-text">{formatBytes(healthData.processMemory.rss)}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-dark-hover h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (healthData.processMemory.rss / (1024 * 1024 * 512)) * 100)}%` }} // normalized relative to 512MB
                        />
                      </div>
                    </div>

                    {/* V8 Node Engine Heap Used */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 font-medium font-mono">Heap (Used / Total)</span>
                        <span className="font-mono font-bold text-gray-800 dark:text-dark-text">{formatBytes(healthData.processMemory.heapUsed)} / {formatBytes(healthData.processMemory.heapTotal)}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-dark-hover h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-purple-500 h-full transition-all duration-300"
                          style={{ width: `${(healthData.processMemory.heapUsed / healthData.processMemory.heapTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-gray-50 dark:border-dark-border pt-4 text-xs font-medium text-gray-500 dark:text-dark-text-muted space-y-2">
                  <div className="flex justify-between">
                    <span>V8 External bindings:</span>
                    <span className="font-mono">{formatBytes(healthData.processMemory.external)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Array buffers:</span>
                    <span className="font-mono">{formatBytes(healthData.processMemory.arrayBuffers)}</span>
                  </div>
                </div>
              </div>

              {/* Database Integrity & Records */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border-light p-5 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-gray-50 dark:border-dark-border pb-3">
                  <Database size={16} className="text-emerald-500" /> Database Diagnostic Check
                </h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Database Size:</span>
                  <span className="font-mono text-sm font-bold text-gray-800 dark:text-dark-text">{formatBytes(healthData.database.dbSize)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">DB SQL WAL Status:</span>
                  <span className="text-[10px] bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-bold px-2 py-0.5 rounded border border-green-200/20 uppercase tracking-wide">ENABLED WAL</span>
                </div>

                <div className="flex items-center justify-between border-b border-gray-50 dark:border-dark-border pb-2">
                  <span className="text-xs font-medium text-gray-500">PRAGMA Integrity Check:</span>
                  {healthData.database.integrity === 'ok' ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase"><CheckCircle2 size={12} /> {healthData.database.integrity}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-bold uppercase"><XCircle size={12} /> FAILED</span>
                  )}
                </div>

                {/* Sub-records grids */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-gray-50 dark:bg-dark-elevated p-2 rounded-xl border border-gray-100 dark:border-dark-border">
                    <span className="block text-[9px] uppercase font-bold text-gray-400">Videos Indexed</span>
                    <span className="text-sm font-bold dark:text-white font-mono">{healthData.database.records.videos}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-elevated p-2 rounded-xl border border-gray-100 dark:border-dark-border">
                    <span className="block text-[9px] uppercase font-bold text-gray-400">Total Users</span>
                    <span className="text-sm font-bold dark:text-white font-mono">{healthData.database.records.channels}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-elevated p-2 rounded-xl border border-gray-100 dark:border-dark-border">
                    <span className="block text-[9px] uppercase font-bold text-gray-400">Playlists</span>
                    <span className="text-sm font-bold dark:text-white font-mono">{healthData.database.records.playlists}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-elevated p-2 rounded-xl border border-gray-100 dark:border-dark-border">
                    <span className="block text-[9px] uppercase font-bold text-gray-400">Comments</span>
                    <span className="text-sm font-bold dark:text-white font-mono">{healthData.database.records.comments}</span>
                  </div>
                </div>
              </div>

              {/* Storage write and structure checklists */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border-light p-5 shadow-sm md:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-gray-50 dark:border-dark-border pb-3">
                  <FolderIcon size={16} className="text-blue-500" /> Instance Directories & Storage Mounts
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-500 dark:text-dark-text-muted">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-dark-border uppercase tracking-wider text-[10px] font-bold text-gray-400">
                        <th className="pb-2">Structure Zone</th>
                        <th className="pb-2 text-center">Accessible</th>
                        <th className="pb-2 text-center">Writable</th>
                        <th className="pb-2 text-right">Items Count</th>
                        <th className="pb-2 text-right">Disk Occupancy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-dark-border font-medium">
                      {healthData.directories.map(dir => (
                        <tr key={dir.name}>
                          <td className="py-2.5">
                            <span className="block text-gray-800 dark:text-dark-text font-semibold">{dir.name}</span>
                            <span className="block font-mono text-[9px] text-gray-400">{dir.path}</span>
                          </td>
                          <td className="py-2.5 text-center">
                            {dir.exists ? (
                              <span className="inline-block text-green-500 fill-current"><CheckCircle2 size={14} className="mx-auto" /></span>
                            ) : (
                              <span className="inline-block text-rose-500 fill-current"><XCircle size={14} className="mx-auto" /></span>
                            )}
                          </td>
                          <td className="py-2.5 text-center">
                            {dir.writable ? (
                              <span className="inline-block text-green-500"><CheckCircle2 size={14} className="mx-auto" /></span>
                            ) : (
                              <span className="inline-block text-rose-500"><XCircle size={14} className="mx-auto" /></span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-mono text-gray-700 dark:text-dark-text-secondary">{dir.fileCount}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-gray-800 dark:text-white">{formatBytes(dir.size)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* External video utilities */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border-light p-5 space-y-4 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-gray-50 dark:border-dark-border pb-3">
                    <Shield size={16} className="text-yellow-500" /> Required Utility Packages
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">ViewTube backend depends on the ffmpeg and ffprobe packages to automatically generate thumbnail previews and strip track duration metadata on import jobs.</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-elevated p-3 rounded-xl border border-gray-100 dark:border-dark-border">
                      <span className="text-xs font-bold text-gray-700 dark:text-dark-text">ffmpeg CLI binary</span>
                      {healthData.utilities.ffmpegInstalled ? (
                        <span className="text-[10px] bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-bold px-2 py-0.5 rounded border border-green-200/20 uppercase">REGISTERED</span>
                      ) : (
                        <span className="text-[10px] bg-red-100 dark:bg-red-950/30 text-rose-700 dark:text-rose-400 font-bold px-2 py-0.5 rounded border border-red-200/20 uppercase">MISSING</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-elevated p-3 rounded-xl border border-gray-100 dark:border-dark-border">
                      <span className="text-xs font-bold text-gray-700 dark:text-dark-text">ffprobe CLI binary</span>
                      {healthData.utilities.ffprobeInstalled ? (
                        <span className="text-[10px] bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-bold px-2 py-0.5 rounded border border-green-200/20 uppercase">REGISTERED</span>
                      ) : (
                        <span className="text-[10px] bg-red-100 dark:bg-red-950/30 text-rose-700 dark:text-rose-400 font-bold px-2 py-0.5 rounded border border-red-200/20 uppercase">MISSING</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-medium text-gray-400 mt-4 leading-normal flex items-start gap-1">
                  <HelpCircle size={12} className="flex-shrink-0 mt-0.5 text-gray-300" />
                  <span>These utilities are natively installed within this Cloud container architecture.</span>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center p-10 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border text-gray-500">
              No health metrics loaded.
            </div>
          )}
        </div>
      )}

      {/* ── OPERATIONS AUDIT LOG TAB ── */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border-light shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 dark:border-dark-border pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal size={16} className="text-red-500" /> Recent Administrative Audit Trail
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Captures crucial operations executing configuration overrides, backups, DB repair procedures, and volume metadata modifications.</p>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search audit trail..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-dark-elevated border-none rounded-lg text-xs focus:ring-2 focus:ring-red-500 text-gray-800 dark:text-dark-text"
              />
            </div>
          </div>

          {logsLoading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw size={28} className="text-red-500 animate-spin mb-2" />
              <p className="text-xs text-gray-500 font-medium">Reconstruction of admin audit trails...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-500 dark:text-dark-text-muted">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-dark-border text-[10px] uppercase font-bold text-gray-400">
                    <th className="pb-2 pl-2">Created timestamp</th>
                    <th className="pb-2">Trigger action</th>
                    <th className="pb-2">Operator profile</th>
                    <th className="pb-2 pr-2">Execution audit parameters / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-dark-border font-medium text-gray-600 dark:text-dark-text-secondary">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-hover/40 transition">
                      <td className="py-3 pl-2 text-gray-400 font-mono text-[10px] whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td className="py-3 whitespace-nowrap">
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getLogBadgeClasses(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-gray-800 dark:text-dark-text">
                        <span className="block">{log.adminName}</span>
                        <span className="block font-mono text-[9px] text-gray-400 font-normal">@{log.adminUsername || log.adminId}</span>
                      </td>
                      <td className="py-3 pr-2 text-xs text-gray-700 dark:text-dark-text-muted leading-normal pr-4">
                        <p>{log.details}</p>
                        <p className="font-mono text-[8px] text-gray-300 dark:text-dark-border mt-0.5 uppercase">Audit ID: {log.id}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 bg-gray-50 dark:bg-dark-hover/20 rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
              <FileText size={28} className="mx-auto text-gray-300 mb-2" />
              <span className="block font-medium text-xs">No administrative actions found matching your query</span>
            </div>
          )}
        </div>
      )}

      {/* ── STORAGE CLEANUP TAB ── */}
      {activeTab === 'cleaner' && (
        <div className="space-y-6">
          
          {/* Diagnostic overview metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Safe reclaimable space</span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block font-mono">
                {cleanerScan ? formatBytes(cleanerScan.orphansTotalSize) : '0 B'}
              </span>
              <p className="text-[10px] text-gray-400 mt-1">Files existing in storage mounts with no SQLite indexes.</p>
            </div>

            <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400">Orphaned uploads found</span>
              <span className="text-2xl font-black text-yellow-500 mt-1 block font-mono">
                {cleanerScan ? cleanerScan.orphanedFiles.length : 0}
              </span>
              <p className="text-[10px] text-gray-400 mt-1">Dead files inside thumbnails, videos, banners, or avatars directories.</p>
            </div>

            <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400">Orphaned Database Records (Broken)</span>
              <span className="text-2xl font-black text-orange-600 mt-1 block font-mono">
                {cleanerScan ? cleanerScan.brokenDbEntries.length : 0}
              </span>
              <p className="text-[10px] text-gray-400 mt-1">SQLite videos containing file paths that do not exist on hard drive.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Orphaned Files Purger Checklist */}
            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-100 dark:border-dark-border-light shadow-sm lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 dark:border-dark-border pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <FileWarning size={16} className="text-yellow-500" /> (A) Orphaned File Purger
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Files located in user upload folders with zero references in database records.</p>
                </div>

                {cleanerScan && cleanerScan.orphanedFiles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={selectAllOrphans}
                      className="px-2.5 py-1 text-[10px] font-bold border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover rounded text-gray-700 dark:text-dark-text uppercase"
                    >
                      {selectedOrphans.length === cleanerScan.orphanedFiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                    
                    <button 
                      onClick={handlePurgeOrphans}
                      disabled={selectedOrphans.length === 0 || purgingOrphans}
                      className="px-2.5 py-1 bg-red-600 dark:bg-red-700 disabled:opacity-40 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-red-700 font-bold flex items-center gap-1 shadow"
                    >
                      <Trash2 size={11} className={purgingOrphans ? 'animate-spin' : ''} /> {purgingOrphans ? 'Purging...' : `Purge (${selectedOrphans.length})`}
                    </button>
                  </div>
                )}
              </div>

              {cleanerLoading && (!cleanerScan || cleanerScan.orphanedFiles.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <RefreshCw size={28} className="text-red-500 animate-spin mb-3" />
                  <p className="text-xs text-gray-400 font-medium">Scanning uploads structure volumes closely...</p>
                </div>
              ) : cleanerScan && cleanerScan.orphanedFiles.length > 0 ? (
                <div className="overflow-y-auto max-h-[420px] pr-2 space-y-2">
                  {cleanerScan.orphanedFiles.map(file => {
                    const isSelected = selectedOrphans.includes(file.path);
                    return (
                      <div 
                        key={file.path} 
                        onClick={() => toggleSelectOrphan(file.path)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border border-gray-50 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover/40 transition cursor-pointer ${
                          isSelected ? 'bg-red-50/40 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/40' : ''
                        }`}
                      >
                        <div className="pt-0.5 text-gray-400 dark:text-dark-border">
                          {isSelected ? (
                            <CheckSquare size={15} className="text-red-600" />
                          ) : (
                            <Square size={15} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-gray-800 dark:text-dark-text truncate" title={file.path}>
                            {file.path.split('/').pop() || file.path}
                          </span>
                          <span className="block text-[10px] text-gray-400 font-mono truncate">{file.path}</span>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded capitalize border tracking-wider bg-gray-100 dark:bg-dark-hover text-gray-500 border-gray-200/50 dark:border-dark-border">
                            {file.type}
                          </span>
                          <span className="block font-mono text-[10px] font-bold text-gray-700 dark:text-dark-text-muted mt-1">{formatBytes(file.size)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500 bg-gray-50/50 dark:bg-dark-hover/10 rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="font-bold text-xs text-gray-700 dark:text-dark-text uppercase tracking-wide">Excellent storage health!</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Zero orphaned files located on server volume directories.</p>
                </div>
              )}
            </div>

            {/* Right: SQLite Broken Video Index Scanner */}
            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-100 dark:border-dark-border-light shadow-sm lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-dark-border pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Database size={16} className="text-orange-500" /> (B) Broken Index Reconciler
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Deletes database entries whose corresponding media file on disk is completely missing.</p>
                </div>

                {cleanerScan && cleanerScan.brokenDbEntries.length > 0 && (
                  <button 
                    onClick={handleRepairDB}
                    disabled={repairingDb}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold uppercase tracking-wider shadow"
                  >
                    {repairingDb ? 'Fixing...' : 'Repair Db Entries'}
                  </button>
                )}
              </div>

              {cleanerLoading && (!cleanerScan || cleanerScan.brokenDbEntries.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <RefreshCw size={24} className="text-red-500 animate-spin mb-3" />
                  <p className="text-xs text-gray-400 font-medium">Reconciling internal database tracks...</p>
                </div>
              ) : cleanerScan && cleanerScan.brokenDbEntries.length > 0 ? (
                <div className="space-y-2 overflow-y-auto max-h-[420px] pr-2">
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-xl text-xs mb-3 flex items-start gap-2">
                    <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-red-600" />
                    <span>The following database video indexes have no backing video file on hard disk filesystem. These create dead items in customer feeds. Repair options will clear them cleanly.</span>
                  </div>

                  {cleanerScan.brokenDbEntries.map(v => (
                    <div 
                      key={v.id} 
                      className="p-3 bg-gray-50 dark:bg-dark-elevated rounded-xl border border-gray-100 dark:border-dark-border"
                    >
                      <span className="block text-xs font-bold text-gray-800 dark:text-dark-text truncate" title={v.title}>{v.title}</span>
                      <span className="block font-mono text-[9px] text-gray-400">DB Video ID: {v.id}</span>
                      <span className="block font-mono text-[9px] text-yellow-600 dark:text-yellow-400 mt-1 truncate">Missing Path: {v.videoPath}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500 bg-gray-50/50 dark:bg-dark-hover/10 rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="font-bold text-xs text-gray-700 dark:text-dark-text uppercase tracking-wide">All file references alive!</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">No broken video index records pointing to mock/unfound targets.</p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
