import { useCallback } from 'react';

import { Image, ListView, Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

const AssetProtocolListContent = ({
  items,
}: {
  items: IStakeProtocolListItem[];
}) => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.AssetProtocolList
  >();
  const { networkId, accountId, symbol } = appRoute.params;
  const appNavigation = useAppNavigation();
  const onPress = useCallback(
    ({ item }: { item: IStakeProtocolListItem }) => {
      appNavigation.navigate(EModalStakingRoutes.UniversalProtocolDetails, {
        accountId,
        networkId,
        symbol: symbol.toUpperCase(),
        provider: item.provider.name,
      });
    },
    [appNavigation, networkId, accountId, symbol],
  );
  return (
    <ListView
      estimatedItemSize={60}
      data={items}
      renderItem={({ item }: { item: IStakeProtocolListItem }) => (
        <ListItem
          title={item.provider.name}
          renderAvatar={<Image src={item.provider.logoURI} size="$8" />}
          onPress={() => onPress({ item })}
        />
      )}
    />
  );
};

const AssetProtocolList = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.AssetProtocolList
  >();
  const { networkId, accountId, symbol } = appRoute.params;
  const { result } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolList({
        networkId,
        accountId,
        symbol,
      }),
    [networkId, accountId, symbol],
    { watchLoading: true },
  );
  return (
    <Page>
      <Page.Header title="Protocal List" />
      <Page.Body>
        {result ? <AssetProtocolListContent items={result} /> : null}
      </Page.Body>
    </Page>
  );
};

export default AssetProtocolList;
