import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const LensIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="12" r="3"/>
    <line x1="12" y1="2" x2="12" y2="4"/>
    <line x1="12" y1="20" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="4" y2="12"/>
    <line x1="20" y1="12" x2="22" y2="12"/>
  </svg>
);

const PersonIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function Navbar({ onUploadClick }: { onUploadClick: () => void }) {
  const { user } = useAuth();
  const loc = useLocation();

  return (
    <nav className="navbar">
      <Link to="/" className={`navbar-btn${loc.pathname === '/' ? ' active' : ''}`} aria-label="Feed">
        <HomeIcon />
      </Link>
      <button className="navbar-shoot" onClick={onUploadClick} aria-label="New post">
        <LensIcon />
      </button>
      <Link to={`/profile/${user?.id}`} className={`navbar-btn${loc.pathname.startsWith('/profile') ? ' active' : ''}`} aria-label="Profile">
        <PersonIcon />
      </Link>
    </nav>
  );
}
