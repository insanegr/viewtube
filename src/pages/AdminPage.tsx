import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, Star, User, Plus, Edit3, Trash2, X, Check, FolderTree, KeyRound, Database, ChevronRight, Film, Bell } from 'lucide-react';
import useStore, { UserRole } from '../store/useStore';
import { useLanguage } from '../i18n/LanguageContext';
import Avatar from '../components/Avatar';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import ImportPage from './ImportPage';
import BackupPage from './BackupPage';
import RecoveryRequestsPage from './RecoveryRequestsPage';

type AdminSection = 'overview' | 'users' | 'recovery' | 'categories' | 'import' | 'backups';

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
  const channels = useStore((s) => s.channels);
  const updateUserRole = useStore((s) => s.updateUserRole);

  const getRoleIcon = (role: UserRole) => role === 'admin' ? <Shield size={14} className="text-red-500" /> : role === 'vip' ? <Star size={14} className="text-yellow-500" fill="currentColor" /> : <User size={14} className="text-gray-400 dark:text-dark-text-muted" />;
  const getRoleBadge = (role: UserRole) => role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : role === 'vip' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-700 dark:bg-dark-hover dark:text-dark-text-secondary';

  return (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 bg-gray-50 dark:bg-dark-elevated text-sm font-medium text-gray-600 dark:text-dark-text-secondary border-b border-gray-200 dark:border-dark-border-light">
        <div></div><div>{t('user')}</div><div>{t('role')}</div><div>{t('actions')}</div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-dark-border">
        {channels.map((channel) => (
          <div key={channel.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-center">
            <Avatar name={channel.name} src={channel.avatar} size="sm" />
            <div>
              <p className="text-sm font-medium dark:text-dark-text">{channel.name}</p>
              <p className="text-xs text-gray-500 dark:text-dark-text-muted">@{channel.username || 'no-username'} • {channel.email}</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(channel.role)}`}>{getRoleIcon(channel.role)} {channel.role.toUpperCase()}</div>
            <div className="flex gap-1 flex-wrap justify-end">
              {channel.role === 'user' && <button onClick={() => updateUserRole(channel.id, 'vip')} className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/50 flex items-center gap-1"><Star size={12} /> {t('grantVip')}</button>}
              {channel.role === 'vip' && <button onClick={() => updateUserRole(channel.id, 'user')} className="px-3 py-1 bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-dark-text-secondary rounded text-xs font-medium hover:bg-gray-200 dark:hover:bg-dark-border-light">{t('revokeVip')}</button>}
              {channel.role !== 'admin' && <button onClick={() => updateUserRole(channel.id, 'admin')} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1"><Shield size={12} /> {t('makeAdmin')}</button>}
            </div>
          </div>
        ))}
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

  if (currentUser.role !== 'admin') return <Navigate to="/" replace />;

  const cards = useMemo(() => [
    { label: 'Users', value: channels.length, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Videos', value: videos.length, icon: Film, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Categories', value: categories.length, icon: FolderTree, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Notifications', value: notifications.length, icon: Bell, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ], [channels.length, videos.length, categories.length, notifications.length]);

  const groups = [
    {
      title: 'Main',
      items: [{ key: 'overview', label: 'Admin Panel', icon: LayoutDashboard }],
    },
    {
      title: 'User Management',
      items: [
        { key: 'users', label: 'Users', icon: Users },
        { key: 'recovery', label: 'Recovery Requests', icon: KeyRound },
      ],
    },
    {
      title: 'Video Management',
      items: [
        { key: 'categories', label: 'Category Management', icon: FolderTree },
        { key: 'import', label: 'Import Videos', icon: Film },
      ],
    },
    {
      title: 'Server',
      items: [{ key: 'backups', label: 'Backup & Recovery', icon: Database }],
    },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={28} className="text-red-600 dark:text-red-500" />
        <div>
          <h1 className="text-2xl font-bold dark:text-dark-text">Admin Panel</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">Central place for users, videos, imports, and server operations</p>
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
                <button onClick={() => setSection('import')} className="text-left bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 hover:shadow-md transition">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Film size={18} /> Video Management</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-muted">Manage categories and import videos from mounted drives.</p>
                </button>
                <button onClick={() => setSection('backups')} className="text-left bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 hover:shadow-md transition md:col-span-2">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Database size={18} /> Server Related</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-muted">Create backups, restore databases, and inspect storage usage.</p>
                </button>
              </div>
            </div>
          )}

          {section === 'users' && <UserManagementPanel />}
          {section === 'recovery' && <RecoveryRequestsPage />}
          {section === 'categories' && <CategoryManagementPanel />}
          {section === 'import' && <ImportPage />}
          {section === 'backups' && <BackupPage />}
        </section>
      </div>
    </div>
  );
}
