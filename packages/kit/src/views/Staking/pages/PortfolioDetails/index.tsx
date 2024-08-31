import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Empty,
  Icon,
  ListView,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IPortfolioItem } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';

type IPortfolioItemProps = {
  item: IPortfolioItem;
  network?: IServerNetwork;
};

const PortfolioItem = ({ item, network }: IPortfolioItemProps) => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalProtocolDetails
  >();
  const { networkId } = route.params;
  const onPress = useCallback(async () => {
    await openTransactionDetailsUrl({ networkId, txid: item.txId });
  }, [item, networkId]);
  const day = Math.ceil(
    Math.max(0, (item.endTime ?? 0) - (item.startTime ?? 0)) /
      (1000 * 60 * 60 * 24),
  );
  return (
    <Stack px={20}>
      <Stack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        <XStack px={14} pt={14} justifyContent="space-between">
          <Badge>{item.status}</Badge>
          <Button
            onPress={onPress}
            size="small"
            variant="tertiary"
            iconAfter="OpenOutline"
          >
            {accountUtils.shortenAddress({ address: item.txId })}
          </Button>
        </XStack>
        <XStack p={14} alignItems="center">
          <Stack pr={12}>
            <Token tokenImageUri={network?.logoURI} />
          </Stack>
          <Stack>
            <SizableText size="$headingLg">{item.amount} BTC</SizableText>
            <SizableText size="$bodyMd">$665.45</SizableText>
          </Stack>
        </XStack>
        <XStack p={14} bg="$bgSubdued" alignItems="center">
          <Icon name="Calendar2Outline" />
          <XStack w="$1.5" />
          <SizableText size="$bodyMd">
            {`${day} days • ${formatDate(new Date(Number(item.startTime)), {
              hideTimeForever: true,
            })} - ${formatDate(new Date(Number(item.endTime)), {
              hideTimeForever: true,
            })}`}
          </SizableText>
        </XStack>
      </Stack>
    </Stack>
  );
};

const ItemSeparatorComponent = () => <Stack h="$4" />;

const PortfolioDetails = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalProtocolDetails
  >();
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
      ]),
    [accountId, networkId, symbol, provider],
    { watchLoading: true },
  );
  const renderItem = useCallback(
    ({ item }: { item: IPortfolioItem }) => (
      <PortfolioItem item={item} network={result?.[1]} />
    ),
    [result],
  );
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header title="Portfolio Details" />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={SimpleSpinnerSkeleton}
          error={isErrorState({ result, isLoading })}
          loading={isLoadingState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? (
            <ListView
              estimatedItemSize={60}
              data={result[0]}
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
