import type { PropsWithChildren } from 'react';

import { HomeTokenListProviderMirror } from '../../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { HomePortfolioStoreController } from '../../components/TokenListBlock/HomePortfolioStoreController';

import { HomeAccountValuePersistenceController } from './HomeAccountValuePersistenceController';
import { HomeBalanceStoreController } from './HomeBalanceStoreController';
import { HomeBannerStoreController } from './HomeBannerStoreController';
import { HomeCapabilityStoreController } from './HomeCapabilityStoreController';
import { HomeDeFiStoreController } from './HomeDeFiStoreController';
import { HomeHistoryStoreController } from './HomeHistoryStoreController';
import { HomeMarketStoreController } from './HomeMarketStoreController';
import { HomeNFTStoreController } from './HomeNFTStoreController';
import { HomePerpsStoreController } from './HomePerpsStoreController';
import { HomeStoreControllerBridge } from './HomeStoreControllerBridge';
import { HomeStoreSnapshotController } from './HomeStoreSnapshotController';

export function HomeStoreSourceControllers({
  children,
  enableWalletSources = false,
}: PropsWithChildren<{ enableWalletSources?: boolean }>) {
  return (
    <>
      <HomeStoreControllerBridge />
      <HomeCapabilityStoreController />
      <HomeTokenListProviderMirror>
        <HomeBalanceStoreController />
        {enableWalletSources ? (
          <HomePortfolioStoreController showRecentHistory />
        ) : null}
      </HomeTokenListProviderMirror>
      <HomeStoreSnapshotController />
      {enableWalletSources ? (
        <>
          <HomeAccountValuePersistenceController />
          <HomeBannerStoreController />
          <HomePerpsStoreController />
          <HomeDeFiStoreController />
          <HomeHistoryStoreController />
          <HomeNFTStoreController />
          <HomeMarketStoreController />
        </>
      ) : null}
      {children}
    </>
  );
}
