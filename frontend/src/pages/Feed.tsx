import { useState, useEffect, useCallback } from 'react';
import { api, type Post } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import UploadModal from '../components/UploadModal';

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="15" rx="2"/>
    <circle cx="12" cy="13.5" r="4"/>
    <path d="M8 6l1.5-2.5h5L16 6"/>
    <circle cx="18" cy="10" r="1" fill="currentColor"/>
  </svg>
);

export default function Feed() {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setPosts(await api.posts.feed(token));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  return (
    <div className="app-layout">
      <div className="page-content">
        <header className="topbar">
          <span className="topbar-logo">THE WALL</span>
        </header>

        <div className="feed">
          {loading ? (
            <div className="loading">DEVELOPING…</div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <CameraIcon />
              <h3>NO FRAMES YET</h3>
              <p>Tap someone's phone to connect. Their shots will show up here.</p>
            </div>
          ) : (
            posts.map((post, i) => (
              <PostCard key={post.id} post={post} currentUserId={user?.id ?? 0} index={i} />
            ))
          )}
        </div>
      </div>

      <Navbar onUploadClick={() => setShowUpload(true)} />
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={loadFeed} />}
    </div>
  );
}
