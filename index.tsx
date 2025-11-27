import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { CMSProvider } from './src/cms';
import { ToastProvider, ToastContainer } from './src/components/toast';
import './src/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <CMSProvider>
        <App />
        <ToastContainer position="top-right" />
      </CMSProvider>
    </ToastProvider>
  </React.StrictMode>
);