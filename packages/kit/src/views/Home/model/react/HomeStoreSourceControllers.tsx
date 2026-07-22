import type { PropsWithChildren } from 'react';

import {
  useHomeInteraction,
  useHomeRuntimeState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import { HomeTokenListProviderMirror } from '../../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { HomePortfolioStoreController } from '../../components/TokenListBlock/HomePortfolioStoreController';
import { HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID } from '../sections/spot/homePortfolioControls';

import { HomeAccountValuePersistenceController } from './HomeAccountValuePersistenceController';
import { HomeBalanceStoreController } from './HomeBalanceStoreController';
import { HomeBannerStoreController } from './HomeBannerStoreController';
import { HomeCapabilityStoreController } from './HomeCapabilityStoreController';
import { HomeDeFiStoreController } from './HomeDeFiStoreController';
import { HomeHistoryStoreController } from './HomeHistoryStoreController';
import { HomeMarketStoreController } from './HomeMarketStoreController';
import { HomeNFTStoreController } from './HomeNFTStoreController';
import { HomePerpsStoreController } from './HomePerpsStoreController';
import { HomePortfolioControlPersistenceController } from './HomePortfolioControlPersistenceController';
import { HomeStoreCommandController } from './HomeStoreCommandController';
import { HomeStoreControllerBridge } from './HomeStoreControllerBridge';
import { HomeStoreSnapshotController } from './HomeStoreSnapshotController';

export function HomeStoreSourceControllers({
  children,
  enableWalletSources = false,
}: PropsWithChildren<{ enableWalletSources?: boolean }>) {
  const runtime = useHomeRuntimeState();
  const interaction = useHomeInteraction();
  const walletSourcesReady = Boolean(
    enableWalletSources &&
    runtime.connection === 'ready' &&
    runtime.producerInstanceId,
  );
  const portfolioControlsReady =
    typeof interaction.sectionControls.portfolio?.[
      HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID
    ] === 'boolean';

  return (
    <>
      <HomeStoreControllerBridge />
      {enableWalletSources ? (
        <HomePortfolioControlPersistenceController />
      ) : null}
      <HomeTokenListProviderMirror>
        {walletSourcesReady ? (
          <>
            <HomeBalanceStoreController />
            {portfolioControlsReady ? (
              <HomePortfolioStoreController showRecentHistory />
            ) : null}
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
