import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { BrowserLogDatabase } from './BrowserLogDatabase';
import { BrowserLogStore } from './BrowserLogStore';

export default function createLogStore(): BrowserLogStore | undefined {
  if (!platformEnv.isExtensionBackground) return undefined;
  return new BrowserLogStore(new BrowserLogDatabase());
}
