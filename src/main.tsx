import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// Retire the previous static application's service worker so it cannot serve stale UI.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then(registrations =>
    Promise.all(registrations.filter(registration => registration.active?.scriptURL.endsWith('/sw.js')).map(registration => registration.unregister()))
  ).catch(() => {});
}
