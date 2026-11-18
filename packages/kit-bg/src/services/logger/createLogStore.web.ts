import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { BrowserLogDatabase } from './BrowserLogDatabase';
import { BrowserLogStore } from './BrowserLogStore';

export default function createLogStore(): BrowserLogStore | undefined {
  // Desktop and embedded bundles can also resolve .web files as a fallback.
  if (!platformEnv.isWeb) return undefined;
  return new BrowserLogStore(new BrowserLogDatabase());
}
