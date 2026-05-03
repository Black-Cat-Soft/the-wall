import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Post } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const BASE = '/api';

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const SPROCKET_COUNT = 7;
const sprockets = Array.from({ length: SPROCKET_COUNT });

export default function PostCard({ post, currentUserId, index }: { post: Post; currentUserId: number; index: number }) {
  const { token } = useAuth();
  const initialLiked = post.likes.some(l => l.userId === currentUserId);
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(post._count.likes);

  const handleLike = async () => {
    if (!token) return;
    const prev = { liked, count };
    setLiked(l => !l);
    setCount(c => liked ? c - 1 : c + 1);
    try {
      await api.posts.like(post.id, token);
    } catch {
      setLiked(prev.liked);
      setCount(prev.count);
    }
  };

  const initial = post.author.username[0].toUpperCase();
  const frameNum = String(index + 1).padStart(2, '0');

  return (
    <article className="post-card">
      {/* top sprocket strip */}
      <div className="sprockets">
        {sprockets.map((_, i) => <div key={i} className="sprocket" />)}
      </div>

      <div className="post-inner">
        <div className="post-header">
          <Link to={`/profile/${post.author.id}`}>
            <div className="post-avatar">
              {post.author.avatar
                ? <img src={BASE + post.author.avatar} alt={post.author.username} />
                : initial}
            </div>
          </Link>
          <Link to={`/profile/${post.author.id}`} className="post-username">
            {post.author.username}
          </Link>
          <span className="post-time">{timeAgo(post.createdAt)}</span>
        </div>

        <div className="post-image-wrap">
          <img src={BASE + post.imageUrl} alt={post.caption} loading="lazy" />
        </div>

        <div className="post-footer">
          <div className="post-actions">
            <button className={`like-btn${liked ? ' liked' : ''}`} onClick={handleLike} aria-label="Like">
              <HeartIcon filled={liked} />
              {count > 0 && <span className="like-count">{count}</span>}
            </button>
          </div>
          {post.caption && (
            <p className="post-caption">
              <strong>{post.author.username}</strong>{post.caption}
            </p>
          )}
        </div>
      </div>

      {/* bottom sprocket strip */}
      <div className="sprockets">
        {sprockets.map((_, i) => <div key={i} className="sprocket" />)}
      </div>

      <span className="frame-number">{frameNum}▲</span>
    </article>
  );
}
