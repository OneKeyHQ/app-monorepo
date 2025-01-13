import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';

const PageWebEmbedApi = LazyLoadPage(() => import('./pages/PageWebEmbedApi'));
const PagePrivyLogin = LazyLoadPage(() => import('./pages/PagePrivyLogin'));

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<PageWebEmbedApi />} />
        <Route path="/prime/login" element={<PagePrivyLogin />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
