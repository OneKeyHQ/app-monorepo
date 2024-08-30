import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
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
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IPortfolioItem } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';

type IPortfolioItemProps = {
  item: IPortfolioItem;
};

const PortfolioItem = ({ item }: IPortfolioItemProps) => {
  const onPress = useCallback(() => {}, []);
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
            {accountUtils.shortenAddress({ address: item.txid })}
          </Button>
        </XStack>
        <XStack p={14} alignItems="center">
          <Stack pr={12}>
            <Token />
          </Stack>
          <Stack>
            <SizableText size="$headingLg">0.01 BTC</SizableText>
            <SizableText size="$bodyMd">$665.45</SizableText>
          </Stack>
        </XStack>
        <XStack p={14} bg="$bgSubdued" alignItems="center">
          <Icon name="Calendar2Outline" />
          <XStack w="$1.5" />
          <SizableText size="$bodyMd">
            100 days • 07/30/2024 - 10/30/2024
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
      backgroundApiProxy.serviceStaking.getPortfolioList({
        accountId,
        networkId,
        symbol,
        provider,
      }),
    [accountId, networkId, symbol, provider],
    { watchLoading: true },
  );
  const renderItem = useCallback(
    ({ item }: { item: IPortfolioItem }) => <PortfolioItem item={item} />,
    [],
  );
  return (
    <Page>
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
              data={result}
              renderItem={renderItem}
              ListFooterComponent={<Stack h="$2" />}
              ItemSeparatorComponent={ItemSeparatorComponent}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default PortfolioDetails;
