import { withTabLayout } from '@onekeyhq/components/src/Layout/withTabLayout';

import { toFocusedLazy } from '../../../../../components/LazyRenderWhenFocus';
import NFTMarketCollectionScreen from '../../../../../views/NFTMarket/CollectionDetail';
import NFTMarket from '../../../../../views/NFTMarket/Home';
import NFTMarketLiveMintingList from '../../../../../views/NFTMarket/LiveMintingList';
import PNLDetailScreen from '../../../../../views/NFTMarket/PNL/PNLDetail';
import NFTMarketStatsList from '../../../../../views/NFTMarket/StatsList';
import { HomeRoutes, TabRoutes } from '../../../../routesEnum';

import { tabRoutesConfigBaseMap } from './tabRoutes.base';

import type { TabRouteConfig } from '../../../../types';

const name = TabRoutes.NFT;
const config: TabRouteConfig = {
  ...tabRoutesConfigBaseMap[name],
  component: toFocusedLazy(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    withTabLayout(NFTMarket, name),
    {
      rootTabName: name,
    },
  ),
  children: [
    {
      name: HomeRoutes.NFTMarketStatsList,
      component: NFTMarketStatsList,
    },
    {
      name: HomeRoutes.NFTMarketLiveMintingList,
      component: NFTMarketLiveMintingList,
    },
    {
      name: HomeRoutes.NFTMarketCollectionScreen,
      component: NFTMarketCollectionScreen,
    },
    {
      name: HomeRoutes.NFTPNLScreen,
      component: PNLDetailScreen,
      alwaysShowBackButton: true,
      i18nTitle: 'action__profit_and_loss',
    },
  ],
};
export default config;
