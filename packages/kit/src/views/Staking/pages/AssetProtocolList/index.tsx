import { useCallback, useEffect } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ColorTokens } from '@onekeyhq/components';
import {
  Dialog,
  IconButton,
  ListView,
  NumberSizeableText,
  Page,
  SizableText,
  Skeleton,
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
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { capitalizeString } from '../../utils/utils';

import { AssetProtocolContent } from './AssetProtocolIntro';

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
      my="$0.5"
    >
      <SizableText size="$bodySmMedium" color={color}>
        {label}
      </SizableText>
    </Stack>
  );
}
function AssetProtocolIntroButton({
  providerTypes,
}: {
  providerTypes?: IStakeProtocolListItem['provider']['type'][];
}) {
  const intl = useIntl();
  const onPress = useCallback(() => {
    Dialog.show({
      icon: 'InfoCircleOutline',
      title: intl.formatMessage({ id: ETranslations.earn_staking_methods }),
      renderContent: <AssetProtocolContent providerTypes={providerTypes} />,
      showConfirmButton: false,
      onCancelText: intl.formatMessage({ id: ETranslations.global_got_it }),
    });
  }, [intl, providerTypes]);
  return providerTypes && providerTypes.length > 0 ? (
    <IconButton
      icon="InfoCircleOutline"
      // size="small"
      variant="tertiary"
      onPress={onPress}
    />
  ) : null;
}

function ProviderTypeBadge({
  type,
}: {
  type?: IStakeProtocolListItem['provider']['type'];
}) {
  const intl = useIntl();
  if (!type) {
    return null;
  }

  const getStakeType = () => {
    switch (type) {
      case 'native':
        return 'locked';
      case 'lending':
        return 'lending';
      default:
        return 'liquid';
    }
  };

  const getLabelText = () => {
    switch (type) {
      case 'native':
        return intl.formatMessage({ id: ETranslations.earn_native_staking });
      case 'lending':
        return intl.formatMessage({ id: ETranslations.earn_lending });
      default:
        return intl.formatMessage({ id: ETranslations.earn_liquid_staking });
    }
  };

  return <StakeTypeBadge stakeType={getStakeType()} label={getLabelText()} />;
}

function AssetProtocolListContent({
  items,
}: {
  items: IStakeProtocolListItem[];
}) {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.AssetProtocolList
  >();
  const intl = useIntl();
  const { accountId, indexedAccountId, symbol } = appRoute.params;
  const appNavigation = useAppNavigation();
  const onPress = useCallback(
    async ({ item }: { item: IStakeProtocolListItem }) => {
      defaultLogger.staking.page.selectProvider({
        network: item.network.networkId,
        stakeProvider: item.provider.name,
      });
      const networkId = item.network.networkId;
      const earnAccount =
        await backgroundApiProxy.serviceStaking.getEarnAccount({
          accountId: accountId || '',
          indexedAccountId,
          networkId,
        });
      appNavigation.navigate(EModalStakingRoutes.ProtocolDetailsV2, {
        accountId: earnAccount?.accountId || accountId,
        networkId: item.network.networkId,
        indexedAccountId:
          earnAccount?.account.indexedAccountId || indexedAccountId,
        symbol,
        provider: item.provider.name,
        vault: earnUtils.useVaultProvider({ providerName: item.provider.name })
          ? item.provider.vault
          : undefined,
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
            primary={
              <XStack gap="$1.5" ai="center">
                <SizableText>
                  {capitalizeString(item.provider.name)}
                </SizableText>
                <ProviderTypeBadge type={item.provider.type} />
              </XStack>
            }
            secondary={
              <NumberSizeableText
                userSelect="none"
                color="$textSubdued"
                size="$bodyMd"
                formatterOptions={{ currency: currencySymbol }}
                formatter="marketCap"
              >
                {item.provider.totalFiatValue}
              </NumberSizeableText>
            }
          />
          <ListItem.Text
            align="right"
            primary={
              Number(item.provider.aprWithoutFee) > 0
                ? `${BigNumber(item.provider.aprWithoutFee ?? 0).toFixed(2)}% ${
                    item.provider.rewardUnit
                  }`
                : null
            }
            secondary={
              item.provider.isStaking
                ? intl.formatMessage({
                    id: ETranslations.earn_currently_staking,
                  })
                : undefined
            }
            secondaryTextProps={{
              color: '$textInfo',
              size: '$bodyMd',
            }}
          />
        </ListItem>
      )}
    />
  );
}

function LoadingSkeleton() {
  return (
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
}

function AssetProtocolList() {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.AssetProtocolList
  >();
  const { filter, symbol, networkId, accountId, indexedAccountId } =
    appRoute.params;
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
        accountId,
        indexedAccountId,
        filterNetworkId: filter ? networkId : undefined,
      }),
    [filter, symbol, networkId, accountId, indexedAccountId],
    { watchLoading: true },
  );
  const intl = useIntl();

  const headerRight = useCallback(
    () => (
      <AssetProtocolIntroButton
        providerTypes={result?.map((o) => o.provider.type).filter(Boolean)}
      />
    ),
    [result],
  );

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      void run();
    }
  }, [isFocused, run]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          {
            id: symbol
              ? ETranslations.earn_symbol_staking_provider
              : ETranslations.provider_title,
          },
          {
            symbol,
          },
        )}
        headerRight={headerRight}
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
}

export default AssetProtocolList;
