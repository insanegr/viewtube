import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { KeyRound, X, Copy } from 'lucide-react';
import useStore from '../store/useStore';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { formatDateTime } from '../utils/format';

interface RecoveryRequest {
  id: string;
  channelId: string | null;
  identifier: string;
  note: string;
  status: 'pending' | 'resolved' | 'dismissed';
  tempPassword: string;
  createdAt: string;
  resolvedAt: string;
  channelName?: string;
  channelUsername?: string;
  channelEmail?: string;
}

export default function RecoveryRequestsPage() {
  const currentUser = useStore((s) => s.currentUser);
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const isModeratorRole = currentUser.role === 'moderator' || currentUser.role === 'moderator_vip_plus' || currentUser.role === 'moderator_vip_plus_plus';

  if (currentUser.role !== 'admin' && !isModeratorRole) return <Navigate to="/" replace />;

  const load = async () => {
    setLoading(true);
    try {
      const { api } = await import('../api/client');
      setItems(await api.getRecoveryRequests());
    } catch (e: any) { showToast(e.message || 'Failed to load requests', 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const issueTempPassword = async (id: string) => {
    const ok = await confirm({ title: 'Issue temporary password', message: 'A temporary password will be generated and the user must change it on next login. Continue?', confirmText: 'Generate', danger: false });
    if (!ok) return;
    try {
      const { api } = await import('../api/client');
      const res = await api.resolveRecoveryRequest(id);
      setItems((prev) => prev.map((r) => r.id === id ? { ...r, status: 'resolved', tempPassword: res.tempPassword, resolvedAt: new Date().toISOString() } : r));
      await navigator.clipboard.writeText(res.tempPassword).catch(() => {});
      showToast(`Temporary password created and copied: ${res.tempPassword}`, 'success');
    } catch (e: any) { showToast(e.message || 'Failed to generate password', 'error'); }
  };

  const dismiss = async (id: string) => {
    try {
      const { api } = await import('../api/client');
      await api.dismissRecoveryRequest(id);
      setItems((prev) => prev.map((r) => r.id === id ? { ...r, status: 'dismissed' } : r));
      showToast('Request dismissed', 'success');
    } catch (e: any) { showToast(e.message || 'Failed to dismiss', 'error'); }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <KeyRound size={26} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Recovery Requests</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">Users who forgot their password or email can request admin help here.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500 dark:text-dark-text-muted">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500 dark:text-dark-text-muted">No recovery requests.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {items.map((r) => (
              <div key={r.id} className="p-4 flex flex-col md:flex-row gap-4 md:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium dark:text-dark-text">{r.channelName || 'Unknown user'}</span>
                    {r.channelUsername && <span className="text-xs text-gray-500 dark:text-dark-text-muted">@{r.channelUsername}</span>}
                    {r.channelEmail && <span className="text-xs text-gray-500 dark:text-dark-text-muted">• {r.channelEmail}</span>}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-1">Requested with identifier: <span className="font-medium">{r.identifier}</span></p>
                  {r.note && <p className="text-sm text-gray-500 dark:text-dark-text-muted mt-1">“{r.note}”</p>}
                  <p className="text-xs text-gray-400 dark:text-dark-text-muted mt-2">{formatDateTime(r.createdAt)}</p>
                  {r.status === 'resolved' && r.tempPassword && (
                    <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-400">
                      Temp password: <code className="font-mono">{r.tempPassword}</code>
                      <button onClick={() => navigator.clipboard.writeText(r.tempPassword)} title="Copy"><Copy size={12} /></button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'pending' ? (
                    <>
                      <button onClick={() => issueTempPassword(r.id)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5">
                        <KeyRound size={14} /> Issue temp password
                      </button>
                      <button onClick={() => dismiss(r.id)} className="px-3 py-2 bg-gray-100 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-secondary rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-dark-hover flex items-center gap-1.5">
                        <X size={14} /> Dismiss
                      </button>
                    </>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${r.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-secondary'}`}>
                      {r.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
