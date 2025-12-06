'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    const userStr = localStorage.getItem('admin_user');

    if (!token || !userStr) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return false;
    }

    try {
      // Validate token with API
      await authApi.validateToken();
      const user = JSON.parse(userStr);
      setState({ user, isLoading: false, isAuthenticated: true });
      return true;
    } catch {
      // Token invalid, clear storage
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return false;
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await authApi.login(email, password);

      // Handle wrapped API response: { meta: {...}, data: { success, data: { token, user } } }
      const result = response.data || response;

      if (result.success && result.data) {
        const { token, user } = result.data;

        // Verify user has admin role
        if (user.role !== 'ADMIN') {
          throw new Error('Access denied. Admin privileges required.');
        }

        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin_user', JSON.stringify(user));

        setState({ user, isLoading: false, isAuthenticated: true });
        router.push('/');
        return { success: true };
      }

      throw new Error(result.message || 'Login failed');
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      const message = error instanceof Error ? error.message : 'Login failed';
      return { success: false, error: message };
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.push('/login');
  }, [router]);

  return {
    ...state,
    login,
    logout,
    checkAuth,
  };
}
