import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { StyleSheet } from 'react-native';

import {
  Badge,
  ListView,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toFixed(2);
}

const AssetProtocolListContent = ({
  items,
}: {
  items: IStakeProtocolListItem[];
}) => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.AssetProtocolList
  >();
  const { accountId, indexedAccountId, symbol } = appRoute.params;
  const appNavigation = useAppNavigation();
  const onPress = useCallback(
    ({ item }: { item: IStakeProtocolListItem }) => {
      appNavigation.navigate(EModalStakingRoutes.ProtocolDetails, {
        accountId,
        networkId: item.network.networkId,
        indexedAccountId,
        symbol: symbol.toUpperCase(),
        provider: item.provider.name,
      });
    },
    [appNavigation, accountId, indexedAccountId, symbol],
  );
  const [
    {
      currencyInfo: { symbol: currencySymbol },
    },
  ] = useSettingsPersistAtom();
  return (
    <ListView
      estimatedItemSize={60}
      data={items}
      renderItem={({ item }: { item: IStakeProtocolListItem }) => (
        <YStack w="100%" py="$2" px="$5" onPress={() => onPress?.({ item })}>
          <YStack
            borderRadius="$3"
            borderCurve="continuous"
            overflow="hidden"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            {...listItemPressStyle}
          >
            <XStack bg="$bgSubdued" p="$4">
              <Stack pr="$3">
                <Token
                  size="lg"
                  tokenImageUri={item.provider.logoURI}
                  networkImageUri={item.network.logoURI}
                />
              </Stack>
              <YStack flex={1} justifyContent="center">
                <SizableText size="$bodyLgMedium">
                  {item.provider.name}
                </SizableText>
                {Number(item.provider.apr) > 0 ? (
                  <XStack alignItems="center">
                    <SizableText size="$bodyMdMedium" color="$textSuccess">
                      {` ${BigNumber(item.provider.apr).toFixed(2)}%`}
                    </SizableText>
                  </XStack>
                ) : null}
              </YStack>
              {item.provider.labels && item.provider.labels.length > 0 ? (
                <YStack alignItems="flex-end" justifyContent="space-around">
                  {item.provider.labels.map((label) => (
                    <Badge key={label}>{label}</Badge>
                  ))}
                </YStack>
              ) : null}
            </XStack>
            <XStack h="$10" px="$4" ai="center" jc="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                Provider staked
              </SizableText>
              <XStack alignItems="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {`${formatNumber(
                    Number(item.provider.totalStaked),
                  )} ${symbol}`}
                </SizableText>
                <XStack w="$1.5" h="$0.5" />
                <SizableText size="$bodyMd" color="$textSubdued">
                  (
                  {`${currencySymbol} ${formatNumber(
                    Number(item.provider.totalFiatValue),
                  )}`}
                  )
                </SizableText>
              </XStack>
            </XStack>
          </YStack>
        </YStack>
      )}
    />
  );
};

const LoadingSkeleton = () => (
  <Stack w="100%" h="$40" jc="center" ai="center">
    <Spinner size="large" />
  </Stack>
);

const AssetProtocolList = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.AssetProtocolList
  >();
  const { filter, symbol, networkId } = appRoute.params;
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolList({
        networkId,
        symbol,
        filter,
      }),
    [filter, symbol, networkId],
    { watchLoading: true },
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="Select Provider" />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={LoadingSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          <Stack>
            {result ? <AssetProtocolListContent items={result} /> : null}
          </Stack>
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default AssetProtocolList;
