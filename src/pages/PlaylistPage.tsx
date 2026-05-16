import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { GripVertical, Play, Trash2, Image, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useStore, { Video } from '../store/useStore';
import { formatDuration, formatViews, timeAgo } from '../utils/format';

function SortableVideoItem({ video, onRemove }: { video: Video; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 ${isDragging ? 'shadow-lg z-10' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none"
      >
        <GripVertical size={18} />
      </button>

      <Link to={`/watch/${video.id}`} className="w-32 aspect-video bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 relative">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
            <Play size={16} className="text-gray-600" />
          </div>
        )}
        <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
          {formatDuration(video.duration)}
        </span>
      </Link>

      <div className="flex-1 min-w-0">
        <Link to={`/watch/${video.id}`} className="text-sm font-medium line-clamp-1 hover:text-blue-600">
          {video.title}
        </Link>
        <p className="text-xs text-gray-500">{video.channelName}</p>
        <p className="text-xs text-gray-400">
          {formatViews(video.views)} • {timeAgo(video.uploadDate)}
        </p>
      </div>

      <button
        onClick={onRemove}
        className="p-2 hover:bg-red-50 text-red-500 rounded-full flex-shrink-0"
        title="Remove from playlist"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const playlists = useStore((s) => s.playlists);
  const videos = useStore((s) => s.videos);
  const reorderPlaylistVideos = useStore((s) => s.reorderPlaylistVideos);
  const removeVideoFromPlaylist = useStore((s) => s.removeVideoFromPlaylist);
  const updatePlaylistCover = useStore((s) => s.updatePlaylistCover);
  const clearQueue = useStore((s) => s.clearQueue);
  const setPlaylistQueue = useStore((s) => s.setPlaylistQueue);
  const navigate = useNavigate();

  const [, setShowCoverUpload] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const playlist = playlists.find((p) => p.id === id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!playlist) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <p className="text-lg">Playlist not found</p>
      </div>
    );
  }

  const playlistVideos = playlist.videoIds
    .map((vid) => videos.find((v) => v.id === vid))
    .filter((v): v is Video => v !== undefined);

  const coverImage = playlist.coverThumbnail || 
    (playlistVideos.length > 0 ? playlistVideos[0]?.thumbnailUrl : '');

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = playlist.videoIds.indexOf(active.id as string);
      const newIndex = playlist.videoIds.indexOf(over.id as string);
      const newOrder = arrayMove(playlist.videoIds, oldIndex, newIndex);
      reorderPlaylistVideos(playlist.id, newOrder);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      updatePlaylistCover(playlist.id, url);
      setShowCoverUpload(false);
    }
  };

  const handleRemoveCover = () => {
    updatePlaylistCover(playlist.id, '');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Playlist Info Sidebar */}
      <div className="lg:w-80 flex-shrink-0">
        <div className="bg-gradient-to-b from-purple-600 to-indigo-700 rounded-xl p-5 text-white sticky top-20">
          {/* Cover Image */}
          <div className="relative aspect-video rounded-lg overflow-hidden mb-4 bg-black/20">
            {coverImage ? (
              <img src={coverImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play size={40} className="text-white/50" />
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => coverInputRef.current?.click()}
                className="p-1.5 bg-black/50 rounded-full hover:bg-black/70 text-white"
                title="Change cover"
              >
                <Image size={14} />
              </button>
              {playlist.coverThumbnail && (
                <button
                  onClick={handleRemoveCover}
                  className="p-1.5 bg-black/50 rounded-full hover:bg-black/70 text-white"
                  title="Remove cover"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
          </div>

          <h1 className="text-xl font-bold">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-sm text-white/80 mt-1">{playlist.description}</p>
          )}
          <p className="text-sm text-white/60 mt-2">{playlist.videoIds.length} videos</p>

          {playlistVideos.length > 0 && (
            <button
              onClick={() => {
                clearQueue();
                // Playlist playback uses its own full ordered list, separate from manual queue.
                setPlaylistQueue(playlistVideos.map((v) => v.id));
                navigate(`/watch/${playlistVideos[0].id}?playlist=${playlist.id}`);
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-white text-gray-900 rounded-full py-2.5 text-sm font-medium hover:bg-gray-100 transition"
            >
              <Play size={16} fill="currentColor" />
              Play All
            </button>
          )}
        </div>
      </div>

      {/* Video List with Drag & Drop Reorder */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Videos</h2>
          <p className="text-sm text-gray-500">Drag to reorder</p>
        </div>

        {playlistVideos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No videos in this playlist</p>
            <p className="text-sm mt-1">Add videos from the watch page</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={playlist.videoIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {playlistVideos.map((video, index) => (
                  <div key={video.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{index + 1}</span>
                    <div className="flex-1">
                      <SortableVideoItem
                        video={video}
                        onRemove={() => removeVideoFromPlaylist(playlist.id, video.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
