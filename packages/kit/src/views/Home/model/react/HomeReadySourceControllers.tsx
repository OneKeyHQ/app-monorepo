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

export function HomeReadySourceControllers({
  portfolioControlsReady,
}: {
  portfolioControlsReady: boolean;
}) {
  return (
    <>
      <HomeBalanceStoreController />
      {portfolioControlsReady ? (
        <HomePortfolioStoreController showRecentHistory />
      ) : null}
      <HomeCapabilityStoreController />
      <HomeAccountValuePersistenceController />
      <HomeBannerStoreController />
      <HomePerpsStoreController />
      <HomeDeFiStoreController />
      <HomeHistoryStoreController />
      <HomeNFTStoreController />
      <HomeMarketStoreController />
    </>
  );
}
