import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Generic API request helper
export async function apiRequest<T>(
  config: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.request<T>(config);
  return response.data;
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/api/v1/auth/admin/login', {
      email,
      password,
    });
    return response.data;
  },

  validateToken: async () => {
    const response = await apiClient.get('/api/v1/auth/admin/validate');
    return response.data;
  },
};

// Whitelist Requests API
export const whitelistRequestsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) => {
    const response = await apiClient.get('/api/v1/admin/whitelist/requests', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/api/v1/admin/whitelist/requests/${id}`);
    return response.data;
  },

  markUnderReview: async (id: string, notes?: string) => {
    const response = await apiClient.put(`/api/v1/admin/whitelist/requests/${id}/review`, { notes });
    return response.data;
  },

  approve: async (id: string, data?: {
    notes?: string;
    name?: string;
    category?: string;
    website?: string;
    twitter?: string;
    logoUrl?: string;
  }) => {
    const response = await apiClient.put(`/api/v1/admin/whitelist/requests/${id}/approve`, data);
    return response.data;
  },

  reject: async (id: string, reason: string) => {
    const response = await apiClient.put(`/api/v1/admin/whitelist/requests/${id}/reject`, { reason });
    return response.data;
  },
};

// Whitelist Entities API
export const whitelistApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    chainId?: number;
    entityType?: string;
    search?: string;
  }) => {
    const response = await apiClient.get('/api/v1/admin/whitelist', { params });
    return response.data;
  },

  create: async (data: {
    entityType: string;
    value: string;
    chainId?: number;
    name: string;
    category: string;
    description?: string;
    website?: string;
    twitter?: string;
    logoUrl?: string;
  }) => {
    const response = await apiClient.post('/api/v1/admin/whitelist', data);
    return response.data;
  },

  update: async (id: string, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/api/v1/admin/whitelist/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/api/v1/admin/whitelist/${id}`);
    return response.data;
  },
};

// Reports API
export const reportsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    entityType?: string;
  }) => {
    const response = await apiClient.get('/api/v1/admin/reports', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/api/v1/admin/reports/${id}`);
    return response.data;
  },

  verify: async (id: string, data?: {
    addToBlacklist?: boolean;
    contributeToUpstream?: boolean;
    threatName?: string;
    notes?: string;
  }) => {
    const response = await apiClient.put(`/api/v1/admin/reports/${id}/verify`, data);
    return response.data;
  },

  reject: async (id: string, reason: string) => {
    const response = await apiClient.put(`/api/v1/admin/reports/${id}/reject`, { reason });
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/api/v1/admin/reports/stats');
    return response.data;
  },
};

// Contributions API (GitHub PRs)
export const contributionsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const response = await apiClient.get('/api/v1/admin/contributions', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/api/v1/admin/contributions/${id}`);
    return response.data;
  },

  syncStatus: async (id: string) => {
    const response = await apiClient.post(`/api/v1/admin/contributions/${id}/sync`);
    return response.data;
  },

  syncAll: async () => {
    const response = await apiClient.post('/api/v1/admin/contributions/sync-all');
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/api/v1/admin/contributions/stats');
    return response.data;
  },

  getConfig: async () => {
    const response = await apiClient.get('/api/v1/admin/contributions/config');
    return response.data;
  },
};

// Activity Log API
export const activityApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await apiClient.get('/api/v1/admin/activity', { params });
    return response.data;
  },
};

// Stats API
export const statsApi = {
  getDashboard: async () => {
    const response = await apiClient.get('/api/v1/admin/stats');
    return response.data;
  },
};
