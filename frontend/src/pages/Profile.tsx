import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type UserProfile } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import UploadModal from '../components/UploadModal';

const BASE = '/api';

const TAP_LABEL: Record<string, string> = {
  none:             'TAP',
  pending_sent:     'REQUESTED',
  pending_received: 'ACCEPT TAP',
  tapped:           'TAPPED ✦',
};

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const userId = parseInt(id ?? '0');
  const isOwn = userId === user?.id;

  const loadProfile = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setProfile(await api.users.profile(userId, token));
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, [id]);

  const handleTap = async () => {
    if (!token || !profile) return;
    try {
      const { tapStatus } = await api.users.tap(userId, token);
      setProfile(p => {
        if (!p) return null;
        const wasTapped = p.tapStatus === 'tapped';
        const nowTapped = tapStatus === 'tapped';
        return {
          ...p,
          tapStatus,
          tapCount: nowTapped ? p.tapCount + 1 : wasTapped ? p.tapCount - 1 : p.tapCount,
        };
      });
    } catch { /* silent */ }
  };

  if (loading) return <div className="loading">DEVELOPING…</div>;
  if (!profile) return null;

  const initial = profile.username[0].toUpperCase();

  return (
    <div className="app-layout">
      <div className="page-content">
        <header className="topbar">
          <span className="topbar-logo">{profile.username}</span>
          {isOwn && (
            <button className="logout-btn" onClick={logout}>LOG OUT</button>
          )}
        </header>

        <div className="profile-hero">
          <div className="profile-avatar">
            {profile.avatar
              ? <img src={BASE + profile.avatar} alt={profile.username} />
              : initial}
          </div>

          <div className="profile-meta">
            <div className="profile-username">{profile.username.toUpperCase()}</div>

            <div className="profile-stats">
              <div className="profile-stat">
                <strong>{profile.posts.length}</strong>
                <span>SHOTS</span>
              </div>
              <div className="profile-stat">
                <strong>{profile.tapCount}</strong>
                <span>TAPS</span>
              </div>
            </div>

            {profile.bio && <p className="profile-bio">{profile.bio}</p>}

            {!isOwn && (
              <button
                className={`tap-btn state-${profile.tapStatus}`}
                onClick={handleTap}
              >
                {TAP_LABEL[profile.tapStatus]}
              </button>
            )}
          </div>
        </div>

        {/* contact sheet grid */}
        <div className="contact-sheet">
          {profile.posts.map((post, i) => (
            <div
              className="contact-frame"
              key={post.id}
              data-frame={String(i + 1).padStart(2, '0')}
            >
              <img src={BASE + post.imageUrl} alt={post.caption} loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      <Navbar onUploadClick={() => setShowUpload(true)} />
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={loadProfile} />}
    </div>
  );
}
