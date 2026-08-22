import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Add a request interceptor
api.interceptors.request.use((config) => {
  // Check if we are in the browser
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Add a response interceptor to handle 401 (Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      // Don't kill session on login failure, 2FA prompt, or vault OTP verification
      const isPublicOrVerification = 
        url.includes('/auth/login') || 
        url.includes('/auth/connect') || 
        url.includes('/vault/verify-otp');

      if (!isPublicOrVerification && typeof window !== 'undefined') {
        localStorage.removeItem('token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login/';
        }
      }
    }
    return Promise.reject(error);
  }
);


export default api;