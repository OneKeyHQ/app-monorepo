import type { PropsWithChildren } from 'react';

import { useHomeRuntimeState } from '@onekeyhq/kit/src/states/jotai/contexts/home';

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
import { HomeStoreCommandController } from './HomeStoreCommandController';
import { HomeStoreControllerBridge } from './HomeStoreControllerBridge';
import { HomeStoreSnapshotController } from './HomeStoreSnapshotController';

export function HomeStoreSourceControllers({
  children,
  enableWalletSources = false,
}: PropsWithChildren<{ enableWalletSources?: boolean }>) {
  const runtime = useHomeRuntimeState();
  const walletSourcesReady = Boolean(
    enableWalletSources &&
    runtime.connection === 'ready' &&
    runtime.producerInstanceId,
  );

  return (
    <>
      <HomeStoreControllerBridge />
      <HomeTokenListProviderMirror>
        {walletSourcesReady ? (
          <>
            <HomeBalanceStoreController />
            <HomePortfolioStoreController showRecentHistory />
          </>
        ) : null}
      </HomeTokenListProviderMirror>
      <HomeStoreSnapshotController />
      {enableWalletSources ? <HomeStoreCommandController /> : null}
      {walletSourcesReady ? (
        <>
          <HomeCapabilityStoreController />
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
