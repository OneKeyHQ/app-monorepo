import React from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  useIsVerticalLayout,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';
import { HomeRoutes } from '../../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../../routes/types';
import AssetsList from '../AssetsList';
import CollectionInfo from '../CollectionInfo';
import { useCollectionDetailContext } from '../context';
import TransactionList from '../TransactionList';
import { TabEnum } from '../type';

const Screen = () => {
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<HomeRoutesParams, HomeRoutes.NFTMarketCollectionScreen>
    >();
  const { networkId, contractAddress } = route.params;
  const isVerticalLayout = useIsVerticalLayout();

  const context = useCollectionDetailContext()?.context;
  const setContext = useCollectionDetailContext()?.setContext;
  const { screenWidth } = useUserDevice();
  const [tabbarBgColor, borderDefault] = useThemeValue([
    'background-default',
    'border-subdued',
  ]);

  return (
    <Tabs.Container
      // @ts-ignore
      refreshing={context?.refreshing}
      onRefresh={() => {
        if (setContext) {
          setContext((ctx) => ({ ...ctx, refreshing: true }));
        }
      }}
      initialTabName="items"
      renderHeader={() => <CollectionInfo />}
      width={isVerticalLayout ? screenWidth : screenWidth - 224} // reduce the width on iPad, sidebar's width is 244
      pagerProps={{ scrollEnabled: false }}
      onIndexChange={(index) => {
        if (setContext) {
          setContext((ctx) => ({ ...ctx, selectedIndex: index }));
        }
      }}
      headerHeight={isVerticalLayout ? 296 : 216}
      containerStyle={{
        paddingLeft: isVerticalLayout ? 0 : 51,
        paddingRight: isVerticalLayout ? 0 : 51,
        maxWidth: MAX_PAGE_CONTAINER_WIDTH,
        width: '100%',
        marginHorizontal: 'auto', // Center align vertically
        backgroundColor: tabbarBgColor,
        alignSelf: 'center',
        flex: 1,
      }}
      headerContainerStyle={{
        shadowOffset: { width: 0, height: 0 },
        shadowColor: 'transparent',
        elevation: 0,
        borderBottomWidth: 1,
        borderBottomColor: borderDefault,
      }}
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
