import type { FC } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import { List, useIsVerticalLayout } from '@onekeyhq/components';

import { useAppSelector, useNavigation } from '../../hooks';

import { OverviewDefiProtocol } from './components/OverviewDefiProtocol';

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

const OverviewDefiListComponent: FC = () => {
  const pageSize = 10;
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const [page, setPage] = useState(0);
  const { networkId, address } = route.params;

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const defis = useAppSelector(
    (s) => s.overview.defi?.[`${networkId}--${address}`] ?? [],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'DeFi',
    });
  }, [navigation]);

  useEffect(() => {
    setTimeout(loadMore, 200);
  }, [loadMore]);

  return (
    <List
      mb="6"
      mt="4"
      mx={isVertical ? 4 : '50px'}
      data={defis.slice(0, page * pageSize)}
      keyExtractor={(item) => item._id?.protocolId}
      showDivider
      renderItem={({ item }) => <OverviewDefiProtocol {...item} />}
      onEndReached={loadMore}
    />
  );
};

export default memo(OverviewDefiListComponent);
