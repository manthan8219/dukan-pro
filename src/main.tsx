import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AuthFlashProvider } from './auth/AuthFlashContext';
import { App } from './App';
import { initFirebaseAnalytics } from './firebase/analytics';
import './index.css';

void initFirebaseAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthFlashProvider>
        <BrowserRouter>
          <App />
          <Analytics />
          <SpeedInsights />
        </BrowserRouter>
      </AuthFlashProvider>
    </AuthProvider>
  </StrictMode>,
);
