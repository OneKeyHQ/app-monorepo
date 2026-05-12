// Empty stub for production builds.
// Metro resolver redirects Developer/router AND Developer/pages/Gallery/*
// to this file when UNION_BUILD=true, completely excluding Gallery and all
// background-only dev dependencies (core/chains, kit-bg/vaults,
// qr-wallet-sdk, bitcoinjs-lib) from the production graph.

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

export const developerRouters: ITabSubNavigatorConfig<any, any>[] = [];

// Default export for Gallery page stubs (LazyLoadPage expects default export)
export default function EmptyDevStub() {
  return null;
}
export const galleryScreenList: any[] = [];
