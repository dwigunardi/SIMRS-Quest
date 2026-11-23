import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformShell } from './platform/PlatformShell';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemen #root tidak ditemukan di index.html');
}

// Cangkang platform memutuskan layar dari URL: Beranda, atau sebuah jalur (jalur SQL = src/App.tsx) yang dimuat malas.
createRoot(rootElement).render(
  <StrictMode>
    <PlatformShell />
  </StrictMode>,
);
