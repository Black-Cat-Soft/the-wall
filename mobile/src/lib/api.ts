import { BRANDING } from '../config/branding';
const BASE = BRANDING.API_URL;

export function resolveAssetUrl(path?: string) {
  if (!path) return undefined;
  return /^(https?:|file:|data:)/.test(path) ? path : BASE + path;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export interface User {
  id: number;
  username: string;
  email?: string;
  bio?: string;
  avatar?: string;
}

export interface Post {
  id: number;
  imageUrl: string;
  caption: string;
  createdAt: string | number;
  authorId: number;
  author: { id: number; username: string; avatar?: string; bio?: string };
  _count: number; // Like count from backend
  isLiked: boolean; // Whether current user liked it
}

export type BumpStatus = 'none' | 'bumped';

export interface UserProfile extends User {
  posts: Post[];
  bumpStatus: BumpStatus;
  bumpCount: number;
}

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string }) =>
      request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  },
  posts: {
    feed: (token: string) => request<Post[]>('/posts/feed', {}, token),
    create: (form: FormData, token: string) =>
      request<Post>('/posts', { method: 'POST', body: form }, token),
    like: (id: number, token: string) =>
      request<{ liked: boolean }>(`/posts/${id}/like`, { method: 'POST' }, token),
  },
  bumps: {
    create: (otherUserId: number, method: 'ble', token: string) =>
      request<{ success: boolean; method: string }>('/bumps', {
        method: 'POST',
        body: JSON.stringify({ otherUserId, method }),
      }, token),
  },
  users: {
    profile: (id: number, token: string) => request<UserProfile>(`/users/${id}`, {}, token),
    me: (token: string) => request<User>('/users/me/profile', {}, token),
    bump: (id: number, token: string) =>
      request<{ bumpStatus: BumpStatus }>(`/users/${id}/bump`, { method: 'POST' }, token),
  },
};
