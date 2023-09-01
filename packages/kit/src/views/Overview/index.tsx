import type { FC } from 'react';
import { memo, useCallback, useLayoutEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import { List, useIsVerticalLayout } from '@onekeyhq/components';
import type { IOverviewAccountdefisResult } from '@onekeyhq/kit-bg/src/services/ServiceOverview';
import { freezedEmptyArray } from '@onekeyhq/shared/src/consts/sharedConsts';

import { useNavigation } from '../../hooks';

import { OverviewDefiProtocol } from './components/OverviewDefiProtocol';
import {
  atomHomeOverviewDefiList,
  useAtomDefiList,
  withProviderDefiList,
} from './contextOverviewDefiList';
import { HandleRebuildDefiListData } from './OverviewDefiList';

import type { HomeRoutes } from '../../routes/routesEnum';
import type { HomeRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/core';

export type OverviewDefiListProps = {
  networkId: string;
  address: string;
};

type RouteProps = RouteProp<
  HomeRoutesParams,
  HomeRoutes.OverviewDefiListScreen
>;

const pageSize = 10;

const OverviewDefiListComponent: FC = () => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const [page, setPage] = useState(1);
  const { networkId, accountId } = route.params;

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const [data] = useAtomDefiList(atomHomeOverviewDefiList);

  const { defis = freezedEmptyArray as IOverviewAccountdefisResult['defis'] } =
    data;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'DeFi',
    });
  }, [navigation]);

  return (
    <>
      <List
        mb="6"
        mt="4"
        mx={isVertical ? 4 : '50px'}
        data={defis.slice(0, page * pageSize)}
        keyExtractor={(item) => item._id?.protocolId}
        showDivider={false}
        renderItem={({ item }) => <OverviewDefiProtocol {...item} />}
        onEndReached={loadMore}
      />

      <HandleRebuildDefiListData
        networkId={networkId}
        accountId={accountId}
        limitSize={pageSize * page}
        debounced={0}
      />
    </>
  );
};

export default memo(withProviderDefiList(OverviewDefiListComponent));
