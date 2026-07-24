import type { PropsWithChildren } from 'react';

import {
  useHomeInteraction,
  useHomeRuntimeState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { HomeTokenListProviderMirror } from '../../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID } from '../sections/spot/homePortfolioControls';

import { HomeDisplaySnapshotController } from './HomeDisplaySnapshotController';
import { HomePortfolioControlPersistenceController } from './HomePortfolioControlPersistenceController';
import { HomeStoreCommandController } from './HomeStoreCommandController';
import { HomeStoreControllerBridge } from './HomeStoreControllerBridge';

const HomeReadySourceControllers = LazyLoad(async () => {
  const { HomeReadySourceControllers: Controllers } =
    await import('./HomeReadySourceControllers');
  return { default: Controllers };
});

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
          <HomeReadySourceControllers
            portfolioControlsReady={portfolioControlsReady}
          />
        ) : null}
      </HomeTokenListProviderMirror>
      {enableWalletSources ? <HomeDisplaySnapshotController /> : null}
      {enableWalletSources ? <HomeStoreCommandController /> : null}
      {children}
    </>
  );
}
