import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ColorTokens } from '@onekeyhq/components';
import {
  Badge,
  ListView,
  Page,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  getColor,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { capitalizeString } from '../../utils/utils';

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

function StakeTypeBadge({
  stakeType,
  label,
}: {
  stakeType: string;
  label: string;
}) {
  const getBadgeColors = (
    type: string,
  ): { bg: ColorTokens; color: ColorTokens } => {
    switch (type) {
      case 'liquid':
        return { bg: '$purple3', color: '$purple11' };
      case 'locked':
        return { bg: '$pink3', color: '$pink11' };
      default:
        return { bg: '$blue3', color: '$blue11' };
    }
  };

  const { bg, color } = getBadgeColors(stakeType);

  return (
    <Stack
      backgroundColor={bg}
      borderRadius="$1"
      borderCurve="continuous"
      px="$2"
      py="$0.5"
    >
      <SizableText size="$bodySmMedium" color={color}>
        {label}
      </SizableText>
    </Stack>
  );
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
        <ListItem userSelect="none" onPress={() => onPress?.({ item })}>
          <Token
            size="lg"
            borderRadius="$2"
            tokenImageUri={item.provider.logoURI}
            networkImageUri={item.network.logoURI}
          />
          <ListItem.Text
            flex={1}
            primary={capitalizeString(item.provider.name)}
            secondary={
              item.provider.labels && item.provider.labels.length > 0 ? (
                <XStack flexWrap="wrap" gap="$1">
                  {item.provider.labels.map((label) => {
                    let stakeType: string;
                    if (label.toLowerCase().includes('liquid')) {
                      stakeType = 'liquid';
                    } else if (label.toLowerCase().includes('native')) {
                      stakeType = 'locked';
                    } else {
                      stakeType = 'current';
                    }
                    return (
                      <StakeTypeBadge
                        key={label}
                        stakeType={stakeType}
                        label={label}
                      />
                    );
                  })}
                </XStack>
              ) : null
            }
          />
          <ListItem.Text
            align="right"
            primary={
              Number(item.provider.apr) > 0
                ? `${BigNumber(item.provider.apr).toFixed(2)}%`
                : null
            }
            secondary={
              <SizableText size="$bodyMd" color="$textSubdued">
                {`TVL ${currencySymbol}${formatNumber(
                  Number(item.provider.totalFiatValue),
                )}`}
              </SizableText>
            }
          />
        </ListItem>
      )}
    />
  );
};

const LoadingSkeleton = () => (
  <Stack>
    {Array.from({ length: 3 }).map((_, index) => (
      <ListItem key={index}>
        <Skeleton w="$10" h="$10" borderRadius="$2" />
        <YStack>
          <YStack py="$1">
            <Skeleton h="$4" w={120} borderRadius="$2" />
          </YStack>
          <YStack py="$1">
            <Skeleton h="$3" w={80} borderRadius="$2" />
          </YStack>
        </YStack>
      </ListItem>
    ))}
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
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.provider_title })}
      />
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
