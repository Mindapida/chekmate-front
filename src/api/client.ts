// API Client for Checkmate

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Get stored token
const getToken = (): string | null => {
  return localStorage.getItem('access_token');
};

// Set token
export const setToken = (token: string): void => {
  localStorage.setItem('access_token', token);
};

// Remove token
export const removeToken = (): void => {
  localStorage.removeItem('access_token');
};

// Check if authenticated
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

// API request helper
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: HeadersInit = {
    ...options.headers,
  };

  // Add auth header if token exists
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // Add content-type for JSON (unless it's FormData)
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 - redirect to login
  if (response.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  // Parse response
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === 'string' 
        ? data.detail 
        : 'Request failed'
    );
  }

  return data;
}

// GET request
export const get = <T>(endpoint: string): Promise<T> => {
  return request<T>(endpoint, { method: 'GET' });
};

// POST request
export const post = <T>(endpoint: string, body?: unknown): Promise<T> => {
  return request<T>(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
};

// PUT request
export const put = <T>(endpoint: string, body?: unknown): Promise<T> => {
  return request<T>(endpoint, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
};

// DELETE request
export const del = <T>(endpoint: string): Promise<T> => {
  return request<T>(endpoint, { method: 'DELETE' });
};

// Upload file(s)
export const uploadFile = <T>(
  endpoint: string,
  files: File | File[],
  additionalData?: Record<string, string>
): Promise<T> => {
  const formData = new FormData();
  
  if (Array.isArray(files)) {
    files.forEach(file => formData.append('files', file));
  } else {
    formData.append('file', files);
  }

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  return post<T>(endpoint, formData);
};

// Get full photo URL
export const getPhotoUrl = (filePath: string): string => {
  const baseUrl = API_URL.replace('/api', '');
  return `${baseUrl}/${filePath}`;
};

export default {
  get,
  post,
  put,
  del,
  uploadFile,
  setToken,
  removeToken,
  isAuthenticated,
  getPhotoUrl,
};

