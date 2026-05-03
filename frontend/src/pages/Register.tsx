import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.auth.register(form);
      login(token, user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">THE WALL</h1>
        <p className="auth-tagline">load your film</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            placeholder="username"
            value={form.username}
            onChange={set('username')}
            required
            autoFocus
          />
          <input
            className="auth-input"
            type="email"
            placeholder="email"
            value={form.email}
            onChange={set('email')}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="password"
            value={form.password}
            onChange={set('password')}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'LOADING FILM…' : 'SHOOT'}
          </button>
        </form>
      </div>
      <div className="auth-footer">
        already loaded? <Link to="/login">log in</Link>
      </div>
    </div>
  );
}
