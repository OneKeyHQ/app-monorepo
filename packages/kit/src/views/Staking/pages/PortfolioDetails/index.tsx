import type { ComponentProps } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Empty,
  Icon,
  ListView,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IBabylonPortfolioItem } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import {
  type IBabylonStatus,
  getBabylonPortfolioTags,
  useBabylonStatusMap,
} from '../../utils/babylon';

type IPortfolioItemProps = {
  item: IBabylonPortfolioItem;
  network?: IServerNetwork;
};

const PortfolioItem = ({ item, network }: IPortfolioItemProps) => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ProtocolDetails
  >();
  const statusMap = useBabylonStatusMap();
  const { networkId } = route.params;
  const onPress = useCallback(async () => {
    await openTransactionDetailsUrl({ networkId, txid: item.txId });
  }, [item, networkId]);
  const day = Math.floor(
    Math.max(1, (item.endTime ?? 0) - (item.startTime ?? 0)) /
      (1000 * 60 * 60 * 24),
  );
  const startDate = formatDate(new Date(Number(item.startTime)), {
    hideTimeForever: true,
  });
  const endDate = formatDate(new Date(Number(item.endTime)), {
    hideTimeForever: true,
  });
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const statusBadgeType: Record<
    IBabylonStatus,
    ComponentProps<typeof Badge>['badgeType']
  > = {
    'active': 'success',
    'withdraw_requested': 'warning',
    'overflow': 'critical',
    'claimable': 'info',
    'claimed': 'default',
    'local_pending_activation': 'default',
  };
  const intl = useIntl();

  return (
    <Stack px={20}>
      <Stack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        <XStack px={14} pt={14} justifyContent="space-between">
          <XStack gap="$1">
            {getBabylonPortfolioTags(item).map((tag) => (
              <Badge key={tag} badgeType={statusBadgeType[tag] ?? 'default'}>
                {statusMap[tag]}
              </Badge>
            ))}
          </XStack>
          {item.txId ? (
            <Button
              onPress={onPress}
              size="small"
              variant="tertiary"
              iconAfter="OpenOutline"
            >
              {accountUtils.shortenAddress({ address: item.txId })}
            </Button>
          ) : null}
        </XStack>
        <XStack p={14} alignItems="center">
          <Stack pr={12}>
            <Token tokenImageUri={network?.logoURI} />
          </Stack>
          <Stack>
            <SizableText size="$headingLg">
              {item.amount} {network?.symbol ?? ''}
            </SizableText>
            {item.fiatValue ? (
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="value"
                formatterOptions={{ currency: symbol }}
              >
                {item.fiatValue}
              </NumberSizeableText>
            ) : null}
          </Stack>
        </XStack>
        {item.startTime && item.endTime ? (
          <XStack p={14} bg="$bgSubdued" alignItems="center">
            <Icon
              width={20}
              height={20}
              name="Calendar2Outline"
              color="$iconSubdued"
            />
            <XStack w="$1.5" />
            <SizableText size="$bodyMd">
              {`${intl.formatMessage(
                { id: ETranslations.earn_number_day },
                { number: day },
              )} • ${startDate} - ${endDate}`}
            </SizableText>
          </XStack>
        ) : null}
      </Stack>
    </Stack>
  );
};

const ItemSeparatorComponent = () => <Stack h="$4" />;

const PortfolioDetails = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ProtocolDetails
  >();
  const intl = useIntl();
  const { accountId, networkId, symbol, provider } = route.params;
  const { result, isLoading, run } = usePromiseResult(
    () =>
      Promise.all([
        backgroundApiProxy.serviceStaking.getPortfolioList({
          accountId,
          networkId,
          symbol,
          provider,
        }),
        backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
        backgroundApiProxy.serviceStaking.getPendingActivationPortfolioList({
          accountId,
          networkId,
        }),
      ]),
    [accountId, networkId, symbol, provider],
    { watchLoading: true },
  );
  const renderItem = useCallback(
    ({ item }: { item: IBabylonPortfolioItem }) => (
      <PortfolioItem item={item} network={result?.[1]} />
    ),
    [result],
  );

  const data = useMemo(() => {
    if (!result) return [];
    const [v1, , v3] = result;
    return [...v3, ...v1];
  }, [result]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_portfolio_details })}
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={SimpleSpinnerSkeleton}
          error={isErrorState({ result, isLoading })}
          loading={isLoadingState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? (
            <ListView
              estimatedItemSize={164}
              data={data}
              renderItem={renderItem}
              ListFooterComponent={<Stack h="$2" />}
              ItemSeparatorComponent={ItemSeparatorComponent}
              ListEmptyComponent={
                <Empty
                  icon="ClockTimeHistoryOutline"
                  title={intl.formatMessage({
                    id: ETranslations.global_no_transactions_yet,
                  })}
                  description={intl.formatMessage({
                    id: ETranslations.global_no_transactions_yet_desc,
                  })}
                />
              }
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default PortfolioDetails;
