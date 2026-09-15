import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './config/router';
import './styles/global.css';
import './styles/cosmos.css';

// Register service worker in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
