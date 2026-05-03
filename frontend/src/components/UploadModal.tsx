import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ onClose, onSuccess }: Props) {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Images only'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  };

  const handleSubmit = async () => {
    if (!file || !token) return;
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('caption', caption);
      await api.posts.create(form, token);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">NEW SHOT</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          {!preview ? (
            <div
              className="upload-zone"
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <span className="upload-icon">⬡</span>
              <p>Drop a frame here or <strong>click to load film</strong></p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          ) : (
            <>
              <img src={preview} alt="preview" className="upload-preview" />
              <button className="change-photo" onClick={() => { setFile(null); setPreview(null); }}>
                ← reload film
              </button>
            </>
          )}

          <textarea
            className="caption-input"
            placeholder="caption…"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />

          {error && <p className="modal-error">{error}</p>}

          <button className="submit-btn" onClick={handleSubmit} disabled={!file || loading}>
            {loading ? 'DEVELOPING…' : 'DEVELOP'}
          </button>
        </div>
      </div>
    </div>
  );
}
