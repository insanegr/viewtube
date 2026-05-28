import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FolderOpen, HardDrive, Check, X, AlertTriangle, Film, Upload, Link2, Move, Plus } from 'lucide-react';
import useStore from '../store/useStore';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../components/Toast';
import { getAllowedVisibility } from '../constants';

interface ScannedFile {
  path: string;
  name: string;
  size: number;
  selected: boolean;
  primaryCategory: string;
  additionalCategories: string[];
  visibility: string;
  alreadyImported?: boolean;
}

interface ImportResult {
  file: string;
  status: 'ok' | 'skip' | 'error';
  title: string;
  message?: string;
}

interface FolderEntry {
  name: string;
  path: string;
}

interface BrowseData {
  importDir: string;
  current: string;
  parent: string | null;
  breadcrumbs: FolderEntry[];
  folders: FolderEntry[];
}

function MultiCategoryDropdown({
  categories,
  selected,
  exclude,
  language,
  onToggle,
  disabled,
}: {
  categories: { id: string; name: string; nameEl: string }[];
  selected: string[];
  exclude: string;
  language: string;
  onToggle: (name: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visible = categories.filter((c) => c.name !== exclude);
  return (
    <div className="relative min-w-[220px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between border border-gray-300 dark:border-dark-border-light dark:bg-dark-input rounded-lg px-3 py-2 text-xs text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-dark-hover'}`}
      >
        <span className="truncate text-gray-700 dark:text-dark-text-secondary">
          {selected.length > 0
            ? selected.map((name) => {
                const c = categories.find((x) => x.name === name);
                return c ? (language === 'el' ? c.nameEl : c.name) : name;
              }).join(', ')
            : 'Select additional'}
        </span>
        <span className="text-gray-400">▾</span>
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500 dark:text-dark-text-muted">No categories</p>
            ) : (
              visible.map((c) => {
                const active = selected.includes(c.name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onToggle(c.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-dark-hover ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-dark-text-secondary'}`}
                  >
                    <span>{language === 'el' ? c.nameEl : c.name}</span>
                    {active && <span>✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ImportPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const currentUser = useStore((s) => s.currentUser);
  const categories = useStore((s) => s.categories);

  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDir, setImportDir] = useState('');
  const [browse, setBrowse] = useState<BrowseData>({ importDir: '', current: '', parent: null, breadcrumbs: [], folders: [] });
  const [scanRecursive, setScanRecursive] = useState(true);
  const [useSubfoldersAsSecondary, setUseSubfoldersAsSecondary] = useState(false);
  const [hasFFmpeg, setHasFFmpeg] = useState(false);
  const [mode, setMode] = useState<'copy' | 'link' | 'move'>('link');
  const [defaultCategory, setDefaultCategory] = useState('Entertainment');
  const [defaultAdditionalCategories, setDefaultAdditionalCategories] = useState<string[]>([]);
  const [defaultVisibility, setDefaultVisibility] = useState('public');
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [selectAll, setSelectAll] = useState(true);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatNameEl, setNewCatNameEl] = useState('');
  const addCategory = useStore((s) => s.addCategory);

  if (currentUser.role !== 'admin') return <Navigate to="/" replace />;

  const ensureCategoryExists = (name: string) => {
    if (!name) return;
    const existing = useStore.getState().categories;
    if (!existing.some((c) => c.name === name)) {
      addCategory(name, name);
    }
  };

  const handleBrowse = async (browsePath = '') => {
    try {
      const { api } = await import('../api/client');
      const data = await api.browseImport(browsePath);
      setImportDir(data.importDir);
      if (data.hasFFmpeg !== undefined) setHasFFmpeg(data.hasFFmpeg);
      setBrowse(data);
    } catch (err: any) {
      showToast(err.message || 'Browse failed', 'error');
    }
  };

  const inferMainAndAdditional = (relativePath: string) => {
    // relativePath coming from the API may include the currently browsed folder prefix.
    // We only want folders *under* the selected folder as secondary categories.
    const currentPrefix = browse.current ? `${browse.current}/` : '';
    const normalized = currentPrefix && relativePath.startsWith(currentPrefix)
      ? relativePath.slice(currentPrefix.length)
      : relativePath;

    const parts = normalized.split('/').filter(Boolean);
    parts.pop(); // remove filename, keep only subfolders under current folder

    const primary = defaultCategory;
    const additional = useSubfoldersAsSecondary
      ? [...new Set(parts.filter((p) => p && p !== primary))]
      : [...defaultAdditionalCategories.filter((c) => c !== primary)];

    return { primary, additional };
  };

  useEffect(() => {
    handleBrowse('');
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setResults(null);
    try {
      const { api } = await import('../api/client');
      const data = await api.scanImport(browse.current || '', scanRecursive);
      setImportDir(data.importDir);
      setHasFFmpeg(data.hasFFmpeg);
      const mapped = data.files.map((f: any) => {
        const inferred = inferMainAndAdditional(f.path);
        inferred.additional.forEach(ensureCategoryExists);
        return { ...f, selected: !f.alreadyImported, primaryCategory: inferred.primary, additionalCategories: inferred.additional, visibility: defaultVisibility };
      });
      setFiles(mapped);
      showToast(`Found ${mapped.length} videos`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Scan failed', 'error');
    }
    setScanning(false);
  };

  const handleImport = async () => {
    const selected = files.filter((f) => f.selected);
    if (selected.length === 0) { showToast('No files selected', 'warning'); return; }
    setImporting(true);
    setResults(null);
    try {
      const { api } = await import('../api/client');
      const data = await api.runImport({
        files: selected.map((f) => ({ path: f.path, primaryCategory: f.primaryCategory, additionalCategories: f.additionalCategories, visibility: f.visibility })),
        mode,
        defaultCategory,
        defaultAdditionalCategories,
        defaultVisibility,
      });
      setResults(data.results);
      showToast(`Imported: ${data.imported}, Skipped: ${data.skipped}, Errors: ${data.errors}`, data.errors > 0 ? 'warning' : 'success');

      // Refresh video list
      const vids = await api.getVideos().catch(() => null);
      if (vids) useStore.setState({ videos: vids });
    } catch (err: any) {
      showToast(err.message || 'Import failed', 'error');
    }
    setImporting(false);
  };

  const toggleAll = (checked: boolean) => {
    setSelectAll(checked);
    setFiles((prev) => prev.map((f) => ({ ...f, selected: checked })));
  };

  const toggleFile = (idx: number) => {
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, selected: !f.selected } : f));
  };

  const setPrimaryCategoryForFile = (idx: number, cat: string) => {
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, primaryCategory: cat, additionalCategories: f.additionalCategories.filter((c) => c !== cat) } : f));
  };

  const toggleAdditionalCategoryForFile = (idx: number, cat: string) => {
    setFiles((prev) => prev.map((f, i) => {
      if (i !== idx) return f;
      const exists = f.additionalCategories.includes(cat);
      return { ...f, additionalCategories: exists ? f.additionalCategories.filter((c) => c !== cat) : [...f.additionalCategories, cat] };
    }));
  };

  const setVisibilityForFile = (idx: number, vis: string) => {
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, visibility: vis } : f));
  };

  const applyDefaultsToAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, primaryCategory: defaultCategory, additionalCategories: defaultAdditionalCategories.filter((c) => c !== defaultCategory), visibility: defaultVisibility })));
  };

  const toggleDefaultAdditionalCategory = (cat: string) => {
    setDefaultAdditionalCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  };

  const selectedCount = files.filter((f) => f.selected).length;
  const totalSize = files.filter((f) => f.selected).reduce((a, f) => a + f.size, 0);

  const clearImportState = () => {
    setFiles([]);
    setResults(null);
    setSelectAll(true);
  };

  const inputCls = "border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <HardDrive size={28} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Import Videos</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">Import videos from your mounted HDD library</p>
        </div>
      </div>

      {/* Folder browser */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-4 mb-4 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-sm">Browse HDD</h2>
            <p className="text-xs text-gray-500 dark:text-dark-text-muted">Choose a folder first, then scan only that folder.</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={scanRecursive} onChange={(e) => setScanRecursive(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              <span>Include subfolders</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={useSubfoldersAsSecondary} onChange={(e) => setUseSubfoldersAsSecondary(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              <span>Use subfolders as secondary categories</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-dark-text-muted">
          <span className="font-medium">Current:</span>
          <button onClick={() => handleBrowse('')} className={`px-2 py-1 rounded ${browse.current === '' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-dark-elevated hover:bg-gray-200 dark:hover:bg-dark-hover'}`}>/videos</button>
          {browse.breadcrumbs.map((b) => (
            <button key={b.path} onClick={() => handleBrowse(b.path)} className={`px-2 py-1 rounded ${browse.current === b.path ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-dark-elevated hover:bg-gray-200 dark:hover:bg-dark-hover'}`}>
              {b.name}
            </button>
          ))}
        </div>

        <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {browse.parent !== null && (
            <button onClick={() => handleBrowse(browse.parent || '')} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-border-light hover:bg-gray-50 dark:hover:bg-dark-hover text-sm">
              <FolderOpen size={16} /> ..
            </button>
          )}
          {browse.folders.map((folder) => (
            <button key={folder.path} onClick={() => handleBrowse(folder.path)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-border-light hover:bg-gray-50 dark:hover:bg-dark-hover text-sm text-left">
              <FolderOpen size={16} className="text-blue-500 flex-shrink-0" />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
          {browse.folders.length === 0 && browse.parent === null && (
            <p className="text-sm text-gray-500 dark:text-dark-text-muted col-span-full">No subfolders found in this location.</p>
          )}
        </div>
      </div>

      {/* Settings bar */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-4 mb-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Mode */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">Transfer mode</label>
            <div className="flex gap-1">
              {(['link', 'copy', 'move'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-hover'}`}>
                  {m === 'link' ? <Link2 size={13} /> : m === 'copy' ? <Upload size={13} /> : <Move size={13} />}
                  {m === 'link' ? 'Symlink' : m === 'copy' ? 'Copy' : 'Move'}
                </button>
              ))}
            </div>
          </div>

          {/* Default main category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">Main category</label>
            <div className="flex gap-1">
              <select value={defaultCategory} onChange={(e) => { setDefaultCategory(e.target.value); setDefaultAdditionalCategories((prev) => prev.filter((c) => c !== e.target.value)); }} className={inputCls}>
                {categories.map((c) => <option key={c.id} value={c.name}>{language === 'el' ? c.nameEl : c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Default additional categories */}
          <div className="min-w-[260px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">Additional categories</label>
            <MultiCategoryDropdown
              categories={categories}
              selected={defaultAdditionalCategories}
              exclude={defaultCategory}
              language={language}
              onToggle={toggleDefaultAdditionalCategory}
            />
          </div>

          {/* Default visibility */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">Default visibility</label>
            <select value={defaultVisibility} onChange={(e) => setDefaultVisibility(e.target.value)} className={inputCls}>
              {getAllowedVisibility('admin').map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button onClick={applyDefaultsToAll} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-secondary rounded-lg hover:bg-gray-200 dark:hover:bg-dark-hover">
            Apply defaults to all
          </button>

          {/* Standalone category creation action */}
          <button onClick={() => setShowNewCat(!showNewCat)} className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1.5 ${showNewCat ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-hover'}`}>
            <Plus size={14} /> Create new category
          </button>

          <div className="flex-1" />

          {files.length > 0 && (
            <button onClick={clearImportState} className="px-4 py-2 bg-gray-100 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-dark-hover flex items-center gap-2">
              <X size={16} /> Clear
            </button>
          )}

          <button onClick={handleScan} disabled={scanning} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {scanning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FolderOpen size={16} />}
            {scanning ? 'Scanning...' : 'Scan HDD'}
          </button>
        </div>

        {/* Inline new category form */}
        {showNewCat && (
          <div className="flex flex-wrap items-end gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-dark-text-muted mb-0.5">English name</label>
              <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Tutorials" className={inputCls + ' w-36'} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-dark-text-muted mb-0.5">Greek name</label>
              <input type="text" value={newCatNameEl} onChange={(e) => setNewCatNameEl(e.target.value)} placeholder="e.g. Μαθήματα" className={inputCls + ' w-36'} />
            </div>
            <button
              disabled={!newCatName.trim() || !newCatNameEl.trim()}
              onClick={() => {
                addCategory(newCatName.trim(), newCatNameEl.trim());
                setNewCatName('');
                setNewCatNameEl('');
                setShowNewCat(false);
                showToast('Category created', 'success');
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create category
            </button>
            <button onClick={() => setShowNewCat(false)} className="px-3 py-1.5 bg-gray-100 dark:bg-dark-elevated text-gray-600 dark:text-dark-text-secondary rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-dark-hover">
              Cancel
            </button>
          </div>
        )}

        {importDir && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-text-muted">
            <HardDrive size={14} />
            <span>Source: <code className="bg-gray-100 dark:bg-dark-elevated px-1.5 py-0.5 rounded">{importDir}</code></span>
            <span>•</span>
            <span>{hasFFmpeg ? '✅ ffmpeg available' : '⚠️ ffmpeg not found — no durations/thumbnails'}</span>
          </div>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mb-4 space-y-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 text-xs font-medium text-gray-600 dark:text-dark-text-secondary bg-gray-50 dark:bg-dark-elevated rounded-t-xl border border-gray-200 dark:border-dark-border-light">
            <input type="checkbox" checked={selectAll} onChange={(e) => toggleAll(e.target.checked)} className="w-3.5 h-3.5 rounded" />
            <div className="flex-1">File ({files.length} found)</div>
            <div className="w-20 text-right">Size</div>
            <div className="w-32">Main</div>
            <div className="w-64">Additional</div>
            <div className="w-24">Visibility</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100 dark:divide-dark-border border-x border-gray-200 dark:border-dark-border-light">
            {files.map((f, i) => {
              const result = results?.find((r) => r.file === f.path);
              return (
                <div 
                  key={f.path} 
                  className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    f.selected ? '' : 'opacity-75'
                  } ${
                    f.alreadyImported 
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-500' 
                      : ''
                  } ${
                    result?.status === 'ok' 
                      ? 'bg-green-50 dark:bg-green-900/10' 
                      : result?.status === 'error' 
                      ? 'bg-red-50 dark:bg-red-900/10' 
                      : result?.status === 'skip' 
                      ? 'bg-yellow-50 dark:bg-yellow-900/10' 
                      : ''
                  }`}
                >
                  <input type="checkbox" checked={f.selected} onChange={() => toggleFile(i)} className="w-3.5 h-3.5 rounded flex-shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Film size={14} className="text-gray-400 dark:text-dark-text-muted flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-medium dark:text-dark-text">{f.name}</p>
                        {f.alreadyImported && (
                          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] px-1 rounded uppercase font-bold">ALREADY IMPORTED</span>
                        )}
                      </div>
                      {f.path !== f.name && <p className="truncate text-[10px] text-gray-400 dark:text-dark-text-muted">{f.path}</p>}
                    </div>
                    {result && (
                      <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${result.status === 'ok' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : result.status === 'skip' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                        {result.status === 'ok' ? <Check size={10} /> : result.status === 'skip' ? <AlertTriangle size={10} /> : <X size={10} />}
                        {result.status === 'ok' ? 'Imported' : result.status === 'skip' ? 'Skipped' : 'Error'}
                      </span>
                    )}
                  </div>
                  <div className="w-20 text-right text-xs text-gray-500 dark:text-dark-text-muted">{(f.size / 1048576).toFixed(0)} MB</div>
                  <select value={f.primaryCategory} onChange={(e) => setPrimaryCategoryForFile(i, e.target.value)} className={inputCls + ' w-32'} disabled={!f.selected}>
                    {categories.map((c) => <option key={c.id} value={c.name}>{language === 'el' ? c.nameEl : c.name}</option>)}
                  </select>
                  <div className="w-64">
                    <MultiCategoryDropdown
                      categories={categories}
                      selected={f.additionalCategories}
                      exclude={f.primaryCategory}
                      language={language}
                      onToggle={(name) => toggleAdditionalCategoryForFile(i, name)}
                      disabled={!f.selected}
                    />
                  </div>
                  <select value={f.visibility} onChange={(e) => setVisibilityForFile(i, e.target.value)} className={inputCls + ' w-24'} disabled={!f.selected}>
                    {getAllowedVisibility('admin').map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-t-0 border-gray-200 dark:border-dark-border-light rounded-b-xl">
            <p className="text-xs text-gray-500 dark:text-dark-text-muted">
              {selectedCount} of {files.length} selected • {(totalSize / 1048576).toFixed(0)} MB total
              {mode === 'link' && ' • Symlink mode (no extra space)'}
            </p>
            <button onClick={handleImport} disabled={importing || selectedCount === 0} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {importing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={16} />}
              {importing ? 'Importing...' : `Import ${selectedCount} videos`}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!scanning && files.length === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
          <HardDrive size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No files scanned yet</p>
          <p className="text-sm mt-1">Click "Scan HDD" to find videos in your mounted library</p>
        </div>
      )}

      {/* Results summary */}
      {results && (
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-4">
          <h3 className="font-medium text-sm mb-2">Import Results</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 dark:text-green-400">✅ {results.filter((r) => r.status === 'ok').length} imported</span>
            <span className="text-yellow-600 dark:text-yellow-400">⏭️ {results.filter((r) => r.status === 'skip').length} skipped</span>
            <span className="text-red-600 dark:text-red-400">❌ {results.filter((r) => r.status === 'error').length} errors</span>
          </div>
        </div>
      )}
    </div>
  );
}
