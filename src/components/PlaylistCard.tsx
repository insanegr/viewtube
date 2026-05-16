import { Link } from 'react-router-dom';
import { ListVideo, Trash2, Play } from 'lucide-react';
import { Playlist } from '../store/useStore';
import useStore from '../store/useStore';

interface PlaylistCardProps {
  playlist: Playlist;
  onDelete?: () => void;
}

export default function PlaylistCard({ playlist, onDelete }: PlaylistCardProps) {
  const videos = useStore((s) => s.videos);
  const playlistVideos = playlist.videoIds
    .map((id) => videos.find((v) => v.id === id))
    .filter(Boolean);

  const coverImage = playlist.coverThumbnail || 
    (playlistVideos.length > 0 ? playlistVideos[0]?.thumbnailUrl : '');

  return (
    <div className="group">
      <Link to={`/playlist/${playlist.id}`} className="block">
        <div className="relative aspect-video bg-gray-200 dark:bg-dark-elevated rounded-xl overflow-hidden">
          {coverImage ? (
            <img src={coverImage} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
              <ListVideo size={32} className="text-white/70" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3 text-white">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Play size={14} fill="white" />
              {playlist.videoIds.length} videos
            </div>
          </div>
          <div className="absolute -right-1.5 top-1 bottom-1 w-3 bg-gray-300/80 dark:bg-dark-border/80 rounded-r-lg -z-10" />
          <div className="absolute -right-3 top-2 bottom-2 w-3 bg-gray-200/60 dark:bg-dark-border/40 rounded-r-lg -z-20" />
        </div>
      </Link>

      <div className="flex items-start justify-between mt-2">
        <Link to={`/playlist/${playlist.id}`} className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate hover:text-blue-600 dark:text-dark-text dark:hover:text-blue-400">{playlist.name}</h3>
          {playlist.description && (
            <p className="text-xs text-gray-500 dark:text-dark-text-muted truncate">{playlist.description}</p>
          )}
        </Link>
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded opacity-0 group-hover:opacity-100 transition"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
