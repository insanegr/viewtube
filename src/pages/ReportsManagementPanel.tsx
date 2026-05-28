import { useState, useEffect } from 'react';
import { Flag, ShieldAlert, Check, X, Shield, MessageSquare, Film, Star, Calendar, VolumeX, Volume2, Ban, Lock } from 'lucide-react';
import { api } from '../api/client';
import useStore from '../store/useStore';
import { useToast } from '../components/Toast';
import Avatar from '../components/Avatar';
import { getRoleLabel } from './AdminPage';
import { safeParseDate } from '../utils/format';

interface Report {
  id: string;
  type: 'video' | 'comment' | 'ban_request';
  targetId: string;
  reporterId: string;
  target_id?: string;
  reporter_id?: string;
  reason: string;
  details: string;
  status: 'pending' | 'resolved' | 'dismissed';
  weight: number;
  created_at?: string;
  createdAt?: string;
  reporterName?: string;
  reporterUsername?: string;
  reporter?: {
    name: string;
    username: string;
  } | null;
  targetDetails?: {
    title?: string;
    text?: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
    channel_id?: string;
    channel_name?: string;
    channel_username?: string;
  } | null;
}

export default function ReportsManagementPanel() {
  const { showToast } = useToast();
  const currentUser = useStore((s) => s.currentUser);
  const channels = useStore((s) => s.channels);
  // Reload channels/users in store when needed to sync muted/banned states
  const fetchGlobalData = async () => {
    try {
      const data = await api.getChannels();
      if (data) {
        useStore.setState({ channels: data });
      }
    } catch (err: any) {
      console.error('Failed to refetch channel data', err);
    }
  };

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');
  
  // Action configurations state
  const [muteDays, setMuteDays] = useState<number>(7);
  const [banDays, setBanDays] = useState<number>(30);
  const [banReason, setBanReason] = useState<string>('');
  const [actioning, setActioning] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await api.getReports();
      setReports(data || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch reports list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const selectedReport = reports.find(r => r.id === selectedReportId);

  // Helper to find target user profile
  const getTargetUserId = (report: Report) => {
    if (report.type === 'ban_request') return report.targetId || report.target_id;
    return report.targetDetails?.channel_id;
  };

  const targetUserId = selectedReport ? getTargetUserId(selectedReport) : null;
  const targetUserChannel = targetUserId ? channels.find(c => c.id === targetUserId) : null;

  const handleUpdateStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      setActioning(true);
      await api.updateReportStatus(reportId, status);
      showToast(`Report successfully marked as ${status}`, 'success');
      // Update local report list state to prevent complete refetch delays
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    } catch (err: any) {
      showToast(err.message || 'Failed to change report status', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleMute = async () => {
    if (!targetUserId || !selectedReport) return;
    try {
      setActioning(true);
      await api.muteUser(targetUserId, muteDays);
      showToast(`User has been muted for ${muteDays} days`, 'success');
      // Refresh global store arrays and list
      await fetchReports();
      await fetchGlobalData();
    } catch (err: any) {
      showToast(err.message || 'Mute failed', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleUnmute = async () => {
    if (!targetUserId || !selectedReport) return;
    try {
      setActioning(true);
      await api.unmuteUser(targetUserId);
      showToast('User has been unmuted', 'success');
      // Refresh state
      await fetchReports();
      await fetchGlobalData();
    } catch (err: any) {
      showToast(err.message || 'Unmute failed', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleForwardForBan = async () => {
    if (!targetUserId || !selectedReport) return;
    try {
      setActioning(true);
      
      // Forward by creating a ban_request report
      await api.submitReport(
        'ban_request',
        targetUserId,
        `Forwarded by Moderator due to multiple reports`,
        `Forwarded for ban review. Original reporter: ${selectedReport.reporterName || selectedReport.reporter?.name || 'anonymous'} with original reason: "${selectedReport.reason}"`
      );

      // Auto-resolve current report
      await api.updateReportStatus(selectedReport.id, 'resolved');
      
      showToast(`Case forwarded to administrators for ban consideration.`, 'success');
      setSelectedReportId(null);
      await fetchReports();
    } catch (err: any) {
      showToast(err.message || 'Failed to forward to administrations', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleBan = async () => {
    if (!targetUserId || !selectedReport) return;
    try {
      setActioning(true);
      await api.banUser(targetUserId, banDays, banReason || 'Violated terms of service & community rules.');
      showToast(`User has been banned and username/email blacklisted.`, 'success');
      await fetchReports();
      await fetchGlobalData();
    } catch (err: any) {
      showToast(err.message || 'Ban action failed', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleUnban = async () => {
    if (!targetUserId || !selectedReport) return;
    try {
      setActioning(true);
      await api.unbanUser(targetUserId);
      showToast(`User unbanned and credentials design white-listed.`, 'success');
      await fetchReports();
      await fetchGlobalData();
    } catch (err: any) {
      showToast(err.message || 'Unban action failed', 'error');
    } finally {
      setActioning(false);
    }
  };

  const filteredReports = reports.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const getWeightBadgeColor = (weight: number) => {
    if (weight >= 4) return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200';
    if (weight >= 3) return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200';
    if (weight >= 2) return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-200';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Flag className="text-red-500" size={24} /> Report Management System
          </h2>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted mt-1">
            Review user-submitted reports for videos, comments, or ban requests. Weighted by user reputation.
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-dark-elevated p-1 text-xs">
          {(['pending', 'resolved', 'dismissed', 'all'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => { setStatusFilter(filter); setSelectedReportId(null); }}
              className={`px-3 py-1.5 rounded-md font-medium capitalize transition-all ${
                statusFilter === filter
                  ? 'bg-white dark:bg-dark-input text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:text-dark-text-muted dark:hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-dark-text-muted">
          Loading system reports. Please wait...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* Left panel: Reports matches list */}
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-100 dark:divide-dark-border max-h-[640px] overflow-y-auto">
              {filteredReports.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-dark-text-muted">
                  <Check className="mx-auto text-green-500 bg-green-50 dark:bg-green-950/30 p-3 rounded-full mb-3" size={48} />
                  <p className="text-base font-semibold text-gray-700 dark:text-white">Clean Slate!</p>
                  <p className="text-xs mt-1">There are no reports matching the selection status.</p>
                </div>
              ) : (
                filteredReports.map((report) => {
                  const isCurrent = report.id === selectedReportId;
                  const dateVal = report.createdAt || report.created_at || '';
                  const dObj = safeParseDate(dateVal);
                  const repDate = dObj ? dObj.toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A';

                  return (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className={`w-full text-left p-4 flex gap-4 transition-all hover:bg-gray-50 dark:hover:bg-dark-hover ${
                        isCurrent ? 'bg-blue-50/40 dark:bg-dark-hover border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="mt-1 flex-shrink-0">
                        {report.type === 'video' && (
                          <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-500">
                            <Film size={20} />
                          </div>
                        )}
                        {report.type === 'comment' && (
                          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-blue-500">
                            <MessageSquare size={20} />
                          </div>
                        )}
                        {report.type === 'ban_request' && (
                          <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-purple-500">
                            <ShieldAlert size={20} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                            {report.type === 'ban_request' ? 'forwarded case' : report.type}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getWeightBadgeColor(report.weight)}`}>
                            W: {report.weight}
                          </span>
                        </div>

                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                          {report.reason}
                        </p>

                        {report.details && (
                          <p className="text-xs text-gray-500 dark:text-dark-text-muted truncate italic">
                            "{report.details}"
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-1">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {repDate}
                          </span>
                          <span>•</span>
                          <span>By: @{report.reporterUsername || report.reporter?.username || 'anonymous'}</span>
                          {report.status !== 'pending' && (
                            <>
                              <span>•</span>
                              <span className={`capitalize font-bold ${report.status === 'resolved' ? 'text-green-600' : 'text-gray-500'}`}>
                                {report.status}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Detail / Operations Controls */}
          <div className="space-y-6">
            {!selectedReport ? (
              <div className="h-full bg-slate-50 dark:bg-dark-elevated/10 border-2 border-dashed border-gray-200 dark:border-dark-border-light rounded-xl flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
                <Shield className="text-gray-300 dark:text-dark-text-muted mb-3" size={48} />
                <p className="text-sm font-semibold text-gray-600 dark:text-dark-text-secondary">No report selected</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
                  Select an entry from the list to view original content, reporter testimony, and execute channel actions.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl shadow-sm p-6 space-y-6">
                
                {/* Status bar */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 block">Report Details</span>
                    <span className="text-xs font-mono text-gray-500">{selectedReport.id}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                    selectedReport.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                    selectedReport.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                    'bg-gray-100 text-gray-700 dark:bg-dark-hover dark:text-dark-text-secondary'
                  }`}>
                    {selectedReport.status}
                  </span>
                </div>

                {/* Reporter Testimony */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reporter Note</h4>
                  <div className="bg-gray-50 dark:bg-dark-elevated/40 rounded-lg p-3 border-l-4 border-l-yellow-500 text-sm">
                    <p className="font-bold text-gray-800 dark:text-white">{selectedReport.reason}</p>
                    {selectedReport.details && (
                      <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1.5 whitespace-pre-line leading-relaxed italic">
                        "{selectedReport.details}"
                      </p>
                    )}
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-2 flex items-center gap-1 font-mono">
                      <Star size={12} className="text-yellow-500" fill="currentColor" /> Filed with weight {selectedReport.weight}
                    </p>
                  </div>
                </div>

                {/* Reported Target Summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Target Content</h4>
                  <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4 space-y-3">
                    {selectedReport.type === 'video' && (
                      <div>
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase inline-block mb-1.5">Video Upload</span>
                        <h5 className="font-bold text-sm text-gray-900 dark:text-white leading-snug">{selectedReport.targetDetails?.title || 'Unknown Video'}</h5>
                        <p className="text-xs text-gray-500 mt-1">Uploaded by: @{selectedReport.targetDetails?.channel_username || 'unknown'}</p>
                      </div>
                    )}

                    {selectedReport.type === 'comment' && (
                      <div>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase inline-block mb-1.5">User Comment</span>
                        <p className="text-sm border-l-2 border-blue-500 pl-3 italic text-gray-800 dark:text-gray-100 font-mono leading-relaxed bg-slate-50/50 dark:bg-dark-hover/40 py-2 rounded-r-lg">
                          "{selectedReport.targetDetails?.text || 'Empty comment context'}"
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Comment by: @{selectedReport.targetDetails?.channel_username || 'unknown'}</p>
                      </div>
                    )}

                    {selectedReport.type === 'ban_request' && (
                      <div>
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase inline-block mb-1.5">Review Forward / Ban Request</span>
                        <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                          {selectedReport.targetDetails?.name}
                          {selectedReport.targetDetails?.role && (
                            <span className="text-[10px] bg-slate-100 dark:bg-dark-hover text-slate-700 dark:text-dark-text-secondary px-1.5 py-0.5 rounded border border-slate-200">
                              {getRoleLabel(selectedReport.targetDetails.role as any).toUpperCase()}
                            </span>
                          )}
                        </h5>
                        <p className="text-xs text-gray-500 mt-1">Username: @{selectedReport.targetDetails?.username}</p>
                        <p className="text-xs text-gray-500">Email: {selectedReport.targetDetails?.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Target profile mute/banned indicator if found */}
                {targetUserChannel && (
                  <div className="bg-slate-50 dark:bg-dark-elevated/10 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={targetUserChannel.name} src={targetUserChannel.avatar} size="sm" />
                      <div>
                        <p className="text-xs font-bold dark:text-white">{targetUserChannel.name} (@{targetUserChannel.username})</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                          Role: {getRoleLabel(targetUserChannel.role).toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap pt-1">
                      {targetUserChannel.mutedUntil ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                          <VolumeX size={10} /> Muted until {new Date(targetUserChannel.mutedUntil).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                          <Volume2 size={10} /> Not Muted
                        </span>
                      )}

                      {targetUserChannel.banned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                          <Ban size={10} /> Banned / Blacklisted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                          <Shield size={10} /> Account Active
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* operations actions */}
                <div className="border-t border-gray-100 dark:border-dark-border pt-6 space-y-6">

                  {/* 1. Report status resolve / dismiss */}
                  {selectedReport.status === 'pending' && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mark Operations Response</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')}
                          disabled={actioning}
                          className="flex items-center justify-center gap-1 py-2 px-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase transition shadow-sm"
                        >
                          <Check size={14} /> Resolve Report
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selectedReport.id, 'dismissed')}
                          disabled={actioning}
                          className="flex items-center justify-center gap-1 py-2 px-3 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase transition shadow-sm"
                        >
                          <X size={14} /> Dismiss Case
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. User Muting Module */}
                  {targetUserChannel && (
                    <div className="space-y-3 bg-amber-50/20 dark:bg-amber-950/5 border border-amber-200/50 dark:border-amber-900/30 p-4 rounded-xl">
                      <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                        <VolumeX size={14} /> Temporary Mute Control
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-dark-text-muted">
                        Muted users are forbidden from creating videos, playlists or comment texts. Can be configured by number of days.
                      </p>

                      {targetUserChannel.mutedUntil ? (
                        <div className="pt-2">
                          <button
                            onClick={handleUnmute}
                            disabled={actioning}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase transition shadow-md shadow-orange-500/10"
                          >
                            <Volume2 size={14} /> Unmute Immediately
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-center justify-between gap-3 bg-white dark:bg-dark-input rounded-lg border border-gray-200 dark:border-dark-border px-3 py-1.5">
                            <span className="text-xs font-medium text-gray-600 dark:text-dark-text">Mute Duration (Days):</span>
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={muteDays}
                              onChange={(e) => setMuteDays(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 bg-transparent text-right font-semibold text-xs text-gray-900 dark:text-white outline-none"
                            />
                          </div>
                          <button
                            onClick={handleMute}
                            disabled={actioning}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase transition shadow-md shadow-amber-500/10"
                          >
                            <VolumeX size={14} /> Mute Channel For {muteDays} Days
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. User Banning / Forward Review Module */}
                  {targetUserChannel && (
                    <div className="space-y-3 bg-red-50/20 dark:bg-red-950/5 border border-red-200/50 dark:border-red-900/30 p-4 rounded-xl">
                      <h4 className="text-xs font-bold text-red-800 dark:text-red-400 flex items-center gap-1 uppercase tracking-wider">
                        <Ban size={14} /> Permanent Ban Controls
                      </h4>

                      {currentUser.role === 'admin' ? (
                        // Admin Full Ban / Unban actions
                        targetUserChannel.banned ? (
                          <div className="space-y-2">
                            <p className="text-[11px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/25 p-2 rounded text-center">
                              This channel is blacklisted & banned.
                            </p>
                            <button
                              onClick={handleUnban}
                              disabled={actioning}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase transition"
                            >
                              <Shield size={14} /> Lift Ban & Un-blacklist User
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-[11px] text-gray-500 dark:text-dark-text-muted">
                              Blacklist the username and email of this user, blocking login entirely. This tool handles cascading log and email alerts.
                            </p>
                            
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-between bg-white dark:bg-dark-input rounded-lg border border-gray-200 dark:border-dark-border px-3 py-1.5">
                                <span className="font-medium text-gray-600 dark:text-dark-text">Ban Limit (Days):</span>
                                <input
                                  type="number"
                                  min={1}
                                  placeholder="Permanent"
                                  value={banDays || ''}
                                  onChange={(e) => setBanDays(parseInt(e.target.value) || 0)}
                                  className="w-24 bg-transparent text-right font-semibold text-gray-900 dark:text-white outline-none"
                                />
                              </div>

                              <input
                                type="text"
                                placeholder="Ban reason text transcript..."
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                className="w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-3 py-1.5 focus:outline-none"
                              />
                            </div>

                            <button
                              onClick={handleBan}
                              disabled={actioning}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase transition shadow-md shadow-red-500/10"
                            >
                              <Ban size={14} /> Ban Channel & Blacklist Credentials
                            </button>
                          </div>
                        )
                      ) : (
                        // Moderator role: Can ONLY forward a suggestion/review to admins
                        <div className="space-y-3.5 pt-1">
                          <p className="text-[11px] text-gray-500 dark:text-dark-text-muted">
                            As a moderator, you lack direct ban permissions. You may escalate or forward this profile directly to the administrator's docket.
                          </p>
                          <button
                            onClick={handleForwardForBan}
                            disabled={actioning}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase transition shadow-md shadow-purple-500/10"
                          >
                            <Lock size={14} /> Forward Case To Admin Review
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
