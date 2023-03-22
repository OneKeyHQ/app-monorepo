import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { useIsVerticalLayout, useUserDevice } from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AssetsList from '../AssetsList';
import CollectionInfo from '../CollectionInfo';
import { useCollectionDetailContext } from '../context';
import TransactionList from '../TransactionList';
import { TabEnum } from '../type';

import type { HomeRoutes } from '../../../../routes/routesEnum';
import type { HomeRoutesParams } from '../../../../routes/types';
import type { RouteProp } from '@react-navigation/core';

const Screen = () => {
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<HomeRoutesParams, HomeRoutes.NFTMarketCollectionScreen>
    >();
  const { networkId, contractAddress } = route.params;
  const isVerticalLayout = useIsVerticalLayout();
  const { screenWidth, screenHeight } = useUserDevice();

  const context = useCollectionDetailContext()?.context;
  const setContext = useCollectionDetailContext()?.setContext;

  let headerHeight = isVerticalLayout ? 296 : 216;
  if (platformEnv.isNativeIOSPad) {
    headerHeight = screenWidth < screenHeight ? 264 : 216;
  }
  return (
    <Tabs.Container
      refreshing={context?.refreshing}
      onRefresh={() => {
        if (setContext) {
          setContext((ctx) => ({ ...ctx, refreshing: true }));
        }
      }}
      initialTabName="items"
      renderHeader={() => (
        <CollectionInfo
          height={headerHeight ? 296 : 216}
          p={{ base: '16px', md: '32px' }}
          bgColor="background-default"
        />
      )}
      onIndexChange={(index) => {
        if (setContext) {
          setContext((ctx) => ({ ...ctx, selectedIndex: index }));
        }
      }}
      headerHeight={headerHeight}
      containerStyle={{
        alignSelf: 'center',
        flex: 1,
      }}
      // scrollEnabled={false}
    >
      <Tabs.Tab
        name={TabEnum.Items}
        label={intl.formatMessage({ id: 'content__items' })}
      >
        <AssetsList contractAddress={contractAddress} networkId={networkId} />
      </Tabs.Tab>
      <Tabs.Tab
        name={TabEnum.Sales}
        label={intl.formatMessage({ id: 'content__sales' })}
      >
        <TransactionList
          contractAddress={contractAddress}
          networkId={networkId}
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default Screen;
