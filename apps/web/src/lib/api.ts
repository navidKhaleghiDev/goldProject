import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  withCredentials: true,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

// Fail offline actions immediately; never queue a financial mutation for reconnection.
api.interceptors.request.use((config) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new axios.AxiosError('برای ادامه به اینترنت متصل شوید.', 'ERR_NETWORK', config);
  }
  return config;
});
