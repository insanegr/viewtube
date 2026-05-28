import { useState, useEffect } from 'react';
import { X, Shield, VolumeX, Ban, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { formatDateTime } from '../utils/format';

interface ModerationReport {
  id: string;
  type: 'video' | 'comment' | 'ban_request';
  reason: string;
  details: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  targetLabel: string;
}

interface ModerationLog {
  id: string;
  action: 'MUTE_USER' | 'UNMUTE_USER' | 'BAN_USER' | 'UNBAN_USER';
  details: string;
  createdAt: string;
  adminName: string;
  adminUsername: string;
}

interface ModerationHistoryData {
  userId: string;
  name: string;
  username: string;
  email: string;
  reportedCount: number;
  mutedCount: number;
  bannedCount: number;
  reports: ModerationReport[];
  logs: ModerationLog[];
}

interface UserModerationHistoryModalProps {
  userId: string;
  onClose: () => void;
}

export default function UserModerationHistoryModal({ userId, onClose }: UserModerationHistoryModalProps) {
  const [data, setData] = useState<ModerationHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'logs'>('reports');
  const { showToast } = useToast();

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const res = await api.getUserModerationHistory(userId);
        if (res) {
          setData(res);
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to fetch moderation profile history', 'error');
      } finally {
        setLoading(false);
      }
    }
    if (userId) {
      loadHistory();
    }
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-card w-full max-w-3xl rounded-xl shadow-2xl border border-gray-100 dark:border-dark-border overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-dark-border-light bg-slate-50 dark:bg-dark-elevated/20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                Moderation Profile
              </h3>
              {data ? (
                <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                  {data.name} (@{data.username}) • {data.email}
                </p>
              ) : (
                <p className="text-xs text-gray-400">Loading channel records...</p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-dark-hover transition text-gray-400 hover:text-gray-600 dark:text-dark-text-muted dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="space-y-4 py-8 text-center text-gray-500 dark:text-dark-text-secondary">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
              <p className="text-xs">Fetching historic logs and reports count...</p>
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-gray-500 dark:text-dark-text-muted space-y-2">
              <AlertTriangle size={36} className="text-amber-500 mx-auto" />
              <p className="font-semibold text-sm">Failed to load moderation history.</p>
              <button 
                onClick={onClose}
                className="text-xs text-blue-500 hover:underline px-3 py-1 bg-blue-50 rounded"
              >
                Close Window
              </button>
            </div>
          ) : (
            <>
              {/* Stat counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Reported Card */}
                <div className="bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Reports Filed</span>
                    <span className="text-2xl font-black text-red-900 dark:text-red-300">{data.reportedCount}</span>
                  </div>
                </div>

                {/* Muted Card */}
                <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <VolumeX size={24} />
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Muted Count</span>
                    <span className="text-2xl font-black text-amber-900 dark:text-amber-300">{data.mutedCount}</span>
                  </div>
                </div>

                {/* Banned Card */}
                <div className="bg-slate-50 dark:bg-slate-850/40 border border-slate-200 dark:border-dark-border p-4 rounded-xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-dark-hover flex items-center justify-center text-slate-700 dark:text-dark-text shrink-0">
                    <Ban size={24} />
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-gray-700 dark:text-dark-text-secondary uppercase tracking-wider">Ban Count</span>
                    <span className="text-2xl font-black text-gray-900 dark:text-white">{data.bannedCount}</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-100 dark:border-dark-border-light flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 px-1 transition ${
                    activeTab === 'reports'
                      ? 'border-red-600 text-red-600 dark:text-red-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-dark-text-muted dark:hover:text-white'
                  }`}
                >
                  Reports Targeting User ({data.reports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 px-1 transition ${
                    activeTab === 'logs'
                      ? 'border-red-600 text-red-600 dark:text-red-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-dark-text-muted dark:hover:text-white'
                  }`}
                >
                  Admin Action Audit Logs ({data.logs.length})
                </button>
              </div>

              {/* Tab Contents */}
              <div className="space-y-4 min-h-[180px]">
                {activeTab === 'reports' ? (
                  data.reports.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-dark-elevated/10 rounded-lg text-xs text-gray-500 dark:text-dark-text-muted">
                      No reports have been filed against this channel or their submitted content.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.reports.map((report) => (
                        <div key={report.id} className="border border-gray-150 dark:border-dark-border-light rounded-xl p-4 bg-white dark:bg-dark-card shadow-sm space-y-2">
                          <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                            <div>
                              <span className="text-slate-400 font-mono text-[9px] uppercase font-bold tracking-wider mr-1.5 bg-slate-100 dark:bg-dark-hover px-1 rounded">
                                {report.type.toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-gray-800 dark:text-dark-text">
                                Reason: {report.reason}
                              </span>
                              <p className="text-[11px] text-gray-500 dark:text-dark-text-secondary mt-0.5">
                                Target item: <strong className="text-gray-700 dark:text-white font-medium">{report.targetLabel}</strong>
                              </p>
                            </div>
                            <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                              report.status === 'pending' 
                                ? 'bg-amber-100 text-amber-800' 
                                : report.status === 'resolved'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-150 text-gray-600 dark:bg-dark-hover'
                            }`}>
                              {report.status}
                            </span>
                          </div>
                          
                          <div className="p-2 sm:p-3 bg-red-50/40 dark:bg-red-950/5 border-l-2 border-red-500 rounded text-xs dark:text-dark-text">
                            <span className="font-bold text-red-800 dark:text-red-400 block text-[10px] uppercase mb-0.5">Context / Claim details:</span>
                            <p className="whitespace-pre-wrap leading-relaxed text-[11px] font-sans">{report.details}</p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                            <span className="flex items-center gap-1"><Clock size={12} /> {formatDateTime(report.createdAt)}</span>
                            <span className="font-medium text-gray-500">Report ID: {report.id}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  data.logs.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-dark-elevated/10 rounded-lg text-xs text-gray-500 dark:text-dark-text-muted">
                      No administrative actions (mutes, bans) are logged for this account.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {data.logs.map((log) => (
                        <div key={log.id} className="p-3 text-[11px] border border-gray-150 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card shadow-sm flex items-start gap-3">
                          <div className={`mt-0.5 p-1 rounded ${
                            log.action.includes('MUTE') 
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {log.action.includes('MUTE') ? <VolumeX size={14} /> : <Ban size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-bold text-gray-800 dark:text-dark-text">{log.action}</span>
                              <span className="text-[10px] text-gray-400 flex items-center gap-1"><Calendar size={10} /> {formatDateTime(log.createdAt)}</span>
                            </div>
                            <p className="text-gray-600 dark:text-dark-text-secondary mt-1 break-words">{log.details}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              Action authorized by: @{log.adminUsername} ({log.adminName})
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated/10 flex justify-end">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold uppercase hover:bg-gray-200 dark:hover:bg-dark-hover text-gray-700 dark:text-white rounded-full bg-gray-150 dark:bg-dark-elevated transition"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}
