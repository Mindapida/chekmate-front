const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const tokenManager = {
  getToken: () => localStorage.getItem('access_token'),
  setToken: (token: string) => localStorage.setItem('access_token', token),
  removeToken: () => localStorage.removeItem('access_token'),
};

const getHeaders = (includeAuth = true): HeadersInit => {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (includeAuth) { const token = tokenManager.getToken(); if (token) headers['Authorization'] = `Bearer ${token}`; }
  return headers;
};

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'GET', headers: getHeaders() });
    if (!response.ok) { if (response.status === 401) { tokenManager.removeToken(); window.location.href = '/login'; } throw new Error(`API Error: ${response.status}`); }
    return response.json();
  },
  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if (!response.ok) { if (response.status === 401) { tokenManager.removeToken(); window.location.href = '/login'; } throw new Error(`API Error: ${response.status}`); }
    return response.json();
  },
  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) });
    if (!response.ok) { if (response.status === 401) { tokenManager.removeToken(); window.location.href = '/login'; } throw new Error(`API Error: ${response.status}`); }
    return response.json();
  },
  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE', headers: getHeaders() });
    if (!response.ok) { if (response.status === 401) { tokenManager.removeToken(); window.location.href = '/login'; } throw new Error(`API Error: ${response.status}`); }
    return response.json();
  },
};














