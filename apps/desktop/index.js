// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable import/first */
/* oxlint-disable import-js/order */
import '@onekeyhq/shared/src/performance/init';

try {
  const {
    coldStartCacheStorage,
  } = require('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
  const {
    EAppSyncStorageKeys,
  } = require('@onekeyhq/shared/src/storage/syncStorageKeys');
  const {
    parseColdStartSnapshotRaw,
  } = require('@onekeyhq/shared/src/utils/coldStartCacheSnapshotUtils');
  const ctxRaw = coldStartCacheStorage.getString(
    EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
  );
  const ctxSnapshot = parseColdStartSnapshotRaw(ctxRaw);
  if (ctxSnapshot) {
    globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__ = ctxSnapshot;
  }
} catch {
  /* desktop cold-start cache is best-effort */
}

if (typeof window !== 'undefined') {
  window.$$onekeyJsReadyAt = Date.now();
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
