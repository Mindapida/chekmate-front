const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

const handleApiError = async (response: Response, endpoint: string) => {
  if (response.status === 401) {
    tokenManager.removeToken();
    window.location.href = '/login';
  }
  const errorText = await response.text().catch(() => 'Unknown error');
  console.error(`❌ API Error ${response.status} on ${endpoint}:`, errorText);
  const error = new Error(`API Error: ${response.status} - ${errorText}`);
  (error as any).status = response.status;
  (error as any).response = { status: response.status, data: errorText };
  throw error;
};

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    console.log(`🌐 GET ${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'GET', headers: getHeaders() });
    if (!response.ok) await handleApiError(response, endpoint);
    return response.json();
  },
  async post<T>(endpoint: string, data: unknown): Promise<T> {
    console.log(`🌐 POST ${endpoint}`, data);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if (!response.ok) await handleApiError(response, endpoint);
    return response.json();
  },
  async put<T>(endpoint: string, data: unknown): Promise<T> {
    console.log(`🌐 PUT ${endpoint}`, data);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) });
    if (!response.ok) await handleApiError(response, endpoint);
    return response.json();
  },
  async delete<T>(endpoint: string): Promise<T> {
    console.log(`🌐 DELETE ${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE', headers: getHeaders() });
    if (!response.ok) await handleApiError(response, endpoint);
    return response.json();
  },
};


















