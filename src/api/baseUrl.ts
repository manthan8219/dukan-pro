const defaultApiUrl = 'http://localhost:3000';

export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.replace(/\/$/, '');
  }
  return defaultApiUrl;
}
