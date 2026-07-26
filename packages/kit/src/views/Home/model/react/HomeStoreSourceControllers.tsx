import type { PropsWithChildren } from 'react';

import { HomeRuntimeRoot } from './HomeRuntimeRoot';

export function HomeStoreSourceControllers({
  children,
  enableWalletSources = false,
}: PropsWithChildren<{ enableWalletSources?: boolean }>) {
  const mode = enableWalletSources ? 'wallet' : 'urlAccount';

  return <HomeRuntimeRoot mode={mode}>{children}</HomeRuntimeRoot>;
}
