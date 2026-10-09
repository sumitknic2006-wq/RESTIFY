import { getToken } from './tokenStorage';

export const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
).replace(/\/+$/, '');

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = response.status === 204 ? null : isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(payload?.message || 'Request failed');
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }

  return payload;
}

const api = {
  getHealth: () => request('/health'),
  get: (path) => request(path),
  post: (path, body) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  put: (path, body) =>
    request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  patch: (path, body) =>
    request(path, {
      method: 'PATCH',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  delete: (path) =>
    request(path, {
      method: 'DELETE',
    }),
};

export default api;
