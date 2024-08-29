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
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';

const AssetProtocolListContent = ({
  items,
}: {
  items: IStakeProtocolListItem[];
}) => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.AssetProtocolList
  >();
  const { networkId, accountId, indexedAccountId, symbol } = appRoute.params;
  const appNavigation = useAppNavigation();
  const onPress = useCallback(
    ({ item }: { item: IStakeProtocolListItem }) => {
      appNavigation.navigate(EModalStakingRoutes.UniversalProtocolDetails, {
        accountId,
        networkId,
        indexedAccountId,
        symbol: symbol.toUpperCase(),
        provider: item.provider.name,
      });
    },
    [appNavigation, networkId, accountId, indexedAccountId, symbol],
  );
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
              <ListItem.Text
                flex={1}
                primary={
                  <XStack alignItems="center">
                    <SizableText size="$bodyLgMedium">
                      {item.provider.name}
                    </SizableText>
                  </XStack>
                }
                secondary={
                  <XStack alignItems="center">
                    <SizableText size="$bodyMdMedium" color="$textSuccess">
                      {`${BigNumber(item.provider.apr).toFixed(3)}%`}
                    </SizableText>
                  </XStack>
                }
              />
              <YStack alignItems="flex-end" justifyContent="space-around">
                <Badge>Native staking</Badge>
                {item.isEarning ? (
                  <Badge badgeType="success">Staking</Badge>
                ) : null}
              </YStack>
            </XStack>
            <XStack h="$10" px="$4" ai="center" jc="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                Provider staked
              </SizableText>
              <NumberSizeableText formatter="balance">
                {item.provider.totalStaked}
              </NumberSizeableText>
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
  const { networkId, accountId, indexedAccountId, symbol } = appRoute.params;
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolList({
        networkId,
        accountId,
        indexedAccountId,
        symbol,
      }),
    [networkId, accountId, indexedAccountId, symbol],
    { watchLoading: true },
  );

  return (
    <Page>
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
