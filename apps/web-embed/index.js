/* oxlint-disable import-js/order */
import '@onekeyhq/shared/src/polyfills';

import React, { Suspense, lazy, useSyncExternalStore } from 'react';

import { createRoot } from 'react-dom/client';

import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { init } from './utils/init';

const PageIndex = lazy(() => import('./pages/PageIndex'));
const PageWebEmbedApi = lazy(() => import('./pages/PageWebEmbedApi'));
const PageWebEmbedPrimePurchase = lazy(
  () => import('./pages/PageWebEmbedPrimePurchase'),
);

const routeComponents = {
  [EWebEmbedRoutePath.index]: PageIndex,
  [EWebEmbedRoutePath.webEmbedApi]: PageWebEmbedApi,
  [EWebEmbedRoutePath.primePurchase]: PageWebEmbedPrimePurchase,
};

function normalizeHashRoutePath(hash) {
  const hashPath = (hash.startsWith('#') ? hash.slice(1) : hash).split('?')[0];
  const routePath = hashPath || EWebEmbedRoutePath.index;
  return routePath.startsWith('/') ? routePath : `/${routePath}`;
}

function getCurrentRoutePath() {
  if (typeof globalThis.location === 'undefined') {
    return EWebEmbedRoutePath.index;
  }
  return normalizeHashRoutePath(globalThis.location.hash || '');
}

function subscribeRouteChange(callback) {
  if (typeof globalThis.addEventListener !== 'function') {
    return () => undefined;
  }
  globalThis.addEventListener('hashchange', callback);
  globalThis.addEventListener('popstate', callback);
  return () => {
    globalThis.removeEventListener('hashchange', callback);
    globalThis.removeEventListener('popstate', callback);
  };
}

function WebEmbedRouter() {
  const routePath = useSyncExternalStore(
    subscribeRouteChange,
    getCurrentRoutePath,
    () => EWebEmbedRoutePath.index,
  );
  const PageComponent = routeComponents[routePath] || PageIndex;
  return <PageComponent />;
}

const container = document.getElementById('root');
const root = createRoot(container);

init();

defaultLogger.app.webembed.renderHtmlRoot();

root.render(
  <React.StrictMode>
    <Suspense fallback={<div />}>
      <WebEmbedRouter />
    </Suspense>
  </React.StrictMode>,
);
