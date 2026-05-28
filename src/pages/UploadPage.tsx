import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Film, Image, Layers, Plus, Minus } from 'lucide-react';
import useStore from '../store/useStore';
import { formatDuration } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';
import { getAllowedVisibility } from '../constants';

interface VideoUpload { id: string; file: File; title: string; description: string; videoUrl: string; thumbnailUrl: string; duration: number; isProcessing: boolean; }

export default function UploadPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const addVideo = useStore((s) => s.addVideo);
  const addVideos = useStore((s) => s.addVideos);
  const categories = useStore((s) => s.categories);
  const currentUser = useStore((s) => s.currentUser);
  const [bulkMode, setBulkMode] = useState(false);
  const [uploads, setUploads] = useState<VideoUpload[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([categories[0]?.name || 'Entertainment']);
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private' | 'user' | 'vip' | 'vip+' | 'vip++'>('public');
  const [dragActive, setDragActive] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [singleTitle, setSingleTitle] = useState('');
  const [singleDescription, setSingleDescription] = useState('');

  const toggleCategory = (catName: string) => { setSelectedCategories((prev) => { if (prev.includes(catName)) { if (prev.length === 1) return prev; return prev.filter((c) => c !== catName); } return [...prev, catName]; }); };

  const extractDuration = useCallback((file: File): Promise<number> => new Promise((resolve) => { const v = document.createElement('video'); v.preload = 'metadata'; const u = URL.createObjectURL(file); v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(u); v.remove(); resolve(isFinite(d) ? d : 0); }; v.onerror = () => { URL.revokeObjectURL(u); v.remove(); resolve(0); }; v.src = u; }), []);
  const generateThumbnail = useCallback((file: File): Promise<string> => new Promise((resolve) => { const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; const u = URL.createObjectURL(file); v.onloadeddata = () => { v.currentTime = v.duration * 0.25; }; v.onseeked = () => { const c = document.createElement('canvas'); c.width = v.videoWidth || 640; c.height = v.videoHeight || 360; const x = c.getContext('2d'); if (x) { x.drawImage(v, 0, 0, c.width, c.height); const d = c.toDataURL('image/jpeg', 0.7); URL.revokeObjectURL(u); v.remove(); resolve(d); } else { URL.revokeObjectURL(u); v.remove(); resolve(''); } }; v.onerror = () => { URL.revokeObjectURL(u); v.remove(); resolve(''); }; v.src = u; }), []);

  const handleVideoSelect = async (files: FileList) => {
    const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/'));
    if (videoFiles.length === 0) return;
    if (bulkMode || videoFiles.length > 1) {
      setBulkMode(true);
      const newUps: VideoUpload[] = [];
      for (const file of videoFiles) { const id = Math.random().toString(36).substr(2,9); newUps.push({ id, file, title: file.name.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' '), description:'', videoUrl: URL.createObjectURL(file), thumbnailUrl:'', duration:0, isProcessing:true }); }
      setUploads(prev => [...prev, ...newUps]);
      for (const up of newUps) { const dur = await extractDuration(up.file); const thumb = await generateThumbnail(up.file); setUploads(prev => prev.map(u => u.id === up.id ? {...u, duration:dur, thumbnailUrl:thumb, isProcessing:false} : u)); }
    } else {
      const file = videoFiles[0]; const id = Math.random().toString(36).substr(2,9); const up: VideoUpload = { id, file, title: file.name.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' '), description:'', videoUrl: URL.createObjectURL(file), thumbnailUrl:'', duration:0, isProcessing:true };
      setUploads([up]); setSingleTitle(up.title);
      const dur = await extractDuration(file); const thumb = await generateThumbnail(file);
      setUploads([{...up, duration:dur, thumbnailUrl:thumb, isProcessing:false}]);
    }
  };

  // Convert a data URL to a File/Blob for upload
  const dataUrlToBlob = (dataUrl: string): Blob | null => {
    try {
      const [header, data] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bytes = atob(data);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch { return null; }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files.length > 0) handleVideoSelect(e.dataTransfer.files); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadProgress(0);

    const newVideos: any[] = [];

    try {
      const token = localStorage.getItem('viewtube-token');
      const uploadFiles = bulkMode ? uploads : [uploads[0]];
      
      for (let i = 0; i < uploadFiles.length; i++) {
        const up = uploadFiles[i];
        const formData = new FormData();
        formData.append('title', bulkMode ? (up.title.trim() || 'Untitled') : (singleTitle.trim() || up.title));
        formData.append('description', bulkMode ? up.description.trim() : singleDescription.trim());
        formData.append('visibility', visibility);
        formData.append('categories', JSON.stringify(selectedCategories));
        formData.append('duration', String(Math.round(up.duration)));
        if (up.file) formData.append('video', up.file);

        // Send thumbnail as a real file if we have a data URL
        if (up.thumbnailUrl && up.thumbnailUrl.startsWith('data:')) {
          const thumbBlob = dataUrlToBlob(up.thumbnailUrl);
          if (thumbBlob) formData.append('thumbnail', thumbBlob, 'thumbnail.jpg');
        }

        const videoData = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/videos');
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const fileProgress = ev.loaded / ev.total;
              const overall = ((i + fileProgress) / uploadFiles.length) * 100;
              setUploadProgress(Math.round(overall));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); } catch { resolve(null); }
            } else reject(new Error('Upload failed'));
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(formData);
        });

        if (videoData) newVideos.push(videoData);
      }

      // Add uploaded videos to local store immediately so they appear without refresh
      if (newVideos.length > 0) {
        const { videos } = useStore.getState();
        useStore.setState({ videos: [...newVideos, ...videos] });
      }

      setUploadProgress(100);
      navigate('/profile');
    } catch {
      // Fallback: local store only
      if (bulkMode) { addVideos(uploads.map(u => ({ title: u.title.trim()||'Untitled', description: u.description.trim(), thumbnailUrl: u.thumbnailUrl, videoUrl: u.videoUrl, duration: Math.round(u.duration), visibility, categories: selectedCategories }))); }
      else if (uploads.length === 1) { addVideo({ title: singleTitle.trim()||uploads[0].title, description: singleDescription.trim(), thumbnailUrl: uploads[0].thumbnailUrl, videoUrl: uploads[0].videoUrl, duration: Math.round(uploads[0].duration), visibility, categories: selectedCategories }); }
      navigate('/profile');
    } finally {
      setIsUploading(false);
    }
  };

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const isProcessing = uploads.some(u => u.isProcessing);
  const canSubmit = uploads.length > 0 && !isProcessing && !isUploading && (bulkMode || singleTitle.trim()) && selectedCategories.length > 0;
  const inputCls = "w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text dark:placeholder:text-dark-text-muted rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{bulkMode ? t('uploadVideos') : t('uploadVideo')}</h1>
        {uploads.length === 0 && (
          <button 
            onClick={() => setBulkMode(!bulkMode)} 
            disabled={currentUser.role !== 'admin' && currentUser.role !== 'vip++' && currentUser.role !== 'moderator'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${bulkMode ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-hover'} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Layers size={16} />{t('bulkUploadMode')}
            {(currentUser.role !== 'admin' && currentUser.role !== 'vip++' && currentUser.role !== 'moderator') && <span className="text-[10px] ml-1 bg-yellow-500 text-black px-1 rounded">VIP++ / MOD</span>}
          </button>
        )}
      </div>

      {bulkMode && uploads.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-sm text-blue-700 dark:text-blue-400">
          <p className="font-medium">{t('bulkUploadMode')}</p><p>{t('bulkUploadDesc')}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {uploads.length === 0 ? (
          <div onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop} onClick={() => videoInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-300 dark:border-dark-border-light hover:border-gray-400 dark:hover:border-dark-hover'}`}>
            <Upload size={48} className="mx-auto mb-4 text-gray-400 dark:text-dark-text-muted" />
            <p className="text-lg font-medium">{t('dragAndDrop')}</p>
            <p className="text-sm text-gray-500 dark:text-dark-text-muted mt-1">{t('orClickToBrowse')}</p>
            <p className="text-xs text-gray-400 dark:text-dark-text-muted mt-3">{t('supported')}</p>
            <input ref={videoInputRef} type="file" accept="video/*" multiple={bulkMode} onChange={(e) => e.target.files && handleVideoSelect(e.target.files)} className="hidden" />
          </div>
        ) : bulkMode ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-dark-text-muted">{uploads.length} {t('videosSelected')}</p>
              <button type="button" onClick={() => videoInputRef.current?.click()} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Add more</button>
              <input ref={videoInputRef} type="file" accept="video/*" multiple onChange={(e) => e.target.files && handleVideoSelect(e.target.files)} className="hidden" />
            </div>
            {uploads.map((up, i) => (
              <div key={up.id} className="bg-gray-50 dark:bg-dark-card rounded-xl p-4 border border-gray-200 dark:border-dark-border-light">
                <div className="flex gap-4">
                  <div className="w-40 aspect-video bg-gray-200 dark:bg-dark-elevated rounded-lg overflow-hidden flex-shrink-0 relative">
                    {up.thumbnailUrl ? <img src={up.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film size={20} className="text-gray-400 dark:text-dark-text-muted" /></div>}
                    {up.isProcessing && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">{formatDuration(up.duration)}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-dark-text-muted font-medium">#{i+1}</span>
                      <input type="text" value={up.title} onChange={(e) => setUploads(prev => prev.map(u => u.id===up.id ? {...u,title:e.target.value} : u))} placeholder={t('title')} className={inputCls} />
                      <button type="button" onClick={() => setUploads(prev => prev.filter(u => u.id!==up.id))} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded"><X size={16} /></button>
                    </div>
                    <input type="text" value={up.description} onChange={(e) => setUploads(prev => prev.map(u => u.id===up.id ? {...u,description:e.target.value} : u))} placeholder={t('description')} className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-dark-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><Film size={20} className="text-gray-500 dark:text-dark-text-muted" /><div><p className="font-medium text-sm">{uploads[0]?.file.name}</p><p className="text-xs text-gray-500 dark:text-dark-text-muted">{((uploads[0]?.file.size||0)/(1024*1024)).toFixed(1)} MB{uploads[0]?.duration>0 && ` • ${formatDuration(uploads[0].duration)}`}</p></div></div>
              <button type="button" onClick={() => setUploads([])} className="p-1 hover:bg-gray-200 dark:hover:bg-dark-hover rounded-full"><X size={16} className="dark:text-dark-text-muted" /></button>
            </div>
            {uploads[0]?.isProcessing && (<div className="mt-3"><div className="h-1 bg-gray-200 dark:bg-dark-elevated rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" /></div><p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">{t('processingVideo')}</p></div>)}
            {uploads[0]?.videoUrl && !uploads[0]?.isProcessing && (<div className="mt-3 rounded-lg overflow-hidden"><video src={uploads[0].videoUrl} className="w-full max-h-64 object-contain bg-black rounded-lg" controls preload="metadata" /></div>)}
          </div>
        )}

        {!bulkMode && uploads.length > 0 && (<>
          <div><label className="block text-sm font-medium mb-1">{t('title')} *</label><input type="text" value={singleTitle} onChange={(e) => setSingleTitle(e.target.value)} placeholder={t('enterVideoTitle')} required className={inputCls + " !px-4 !py-2"} /></div>
          <div><label className="block text-sm font-medium mb-1">{t('description')}</label><textarea value={singleDescription} onChange={(e) => setSingleDescription(e.target.value)} placeholder={t('enterVideoDescription')} rows={4} className={inputCls + " !px-4 !py-2 resize-none"} /></div>
          <div><label className="block text-sm font-medium mb-1">{t('thumbnail')}</label>
            <div className="flex gap-4">
              {uploads[0]?.thumbnailUrl && (<div className="relative w-40 aspect-video rounded-lg overflow-hidden"><img src={uploads[0].thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" /><button type="button" onClick={() => setUploads(prev => prev.map(u => u.id===uploads[0].id?{...u,thumbnailUrl:''}:u))} className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-black/80"><X size={12} /></button></div>)}
              <button type="button" onClick={() => thumbnailInputRef.current?.click()} className="w-40 aspect-video border-2 border-dashed border-gray-300 dark:border-dark-border-light rounded-lg flex flex-col items-center justify-center gap-1 hover:border-gray-400 dark:hover:border-dark-hover text-gray-400 hover:text-gray-500"><Image size={20} /><span className="text-xs">{t('uploadThumbnail')}</span></button>
              <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploads[0] && setUploads(prev => prev.map(u => u.id===uploads[0].id ? {...u, thumbnailUrl: URL.createObjectURL(e.target.files![0])} : u))} className="hidden" />
            </div>
          </div>
        </>)}

        {uploads.length > 0 && (<>
          <div>
            <label className="block text-sm font-medium mb-2">{t('selectCategories')} *</label>
            {selectedCategories.length > 0 && (<div className="flex flex-wrap gap-2 mb-3">{selectedCategories.map((cn) => { const cat = categories.find(c=>c.name===cn); const dn = cat?(language==='el'?cat.nameEl:cat.name):cn; return (<span key={cn} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">{dn}{selectedCategories.length>1 && <button type="button" onClick={() => toggleCategory(cn)} className="hover:text-blue-900 dark:hover:text-blue-200"><X size={14} /></button>}</span>); })}</div>)}
            <div className="relative">
              <button type="button" onClick={() => setShowCategoryPicker(!showCategoryPicker)} className={inputCls + " flex items-center justify-between !px-4 !py-2"}><span>{selectedCategories.length} {t('selectedCategories')}</span><Plus size={16} /></button>
              {showCategoryPicker && (<><div className="fixed inset-0 z-40" onClick={() => setShowCategoryPicker(false)} /><div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-lg shadow-lg max-h-64 overflow-y-auto">{categories.map((cat) => { const isSel = selectedCategories.includes(cat.name); return (<button key={cat.id} type="button" onClick={() => toggleCategory(cat.name)} className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover ${isSel ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'dark:text-dark-text'}`}><span>{language==='el'?cat.nameEl:cat.name}</span><span className={`flex items-center justify-center w-5 h-5 rounded-full ${isSel ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-hover'}`}>{isSel ? <Minus size={12} /> : <Plus size={12} />}</span></button>); })}</div></>)}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('visibility')}</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} className={inputCls + " !px-4 !py-2"}>
              {getAllowedVisibility(currentUser.role).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </>)}

        {/* Upload progress bar */}
        {isUploading && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">{t('uploading')}</span>
              <span className="text-gray-500 dark:text-dark-text-muted tabular-nums">{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-dark-elevated rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
            </div>
            {uploadProgress === 100 && <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">✓ {t('uploadComplete')}</p>}
          </div>
        )}

        {uploads.length > 0 && !isUploading && (
          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={!canSubmit} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{bulkMode ? `${t('uploadNow')} (${uploads.length})` : t('uploadNow')}</button>
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2.5 bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-dark-hover">{t('cancel')}</button>
          </div>
        )}
      </form>
    </div>
  );
}
