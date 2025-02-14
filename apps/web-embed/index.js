import '@onekeyhq/shared/src/polyfills';
import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';

const PageIndex = lazy(() => import('./pages/PageIndex'));
const PageWebEmbedApi = lazy(() => import('./pages/PageWebEmbedApi'));
const PageWebEmbedPrimePurchase = lazy(() =>
  import('./pages/PageWebEmbedPrimePurchase'),
);

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Suspense fallback={<div />}>
      <HashRouter>
        <Routes>
          <Route path={EWebEmbedRoutePath.index} element={<PageIndex />} />
          <Route
            path={EWebEmbedRoutePath.webEmbedApi}
            element={<PageWebEmbedApi />}
          />
          <Route
            path={EWebEmbedRoutePath.primePurchase}
            element={<PageWebEmbedPrimePurchase />}
          />
        </Routes>
      </HashRouter>
    </Suspense>
  </React.StrictMode>,
);
