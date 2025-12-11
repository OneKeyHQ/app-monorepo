import { useCallback, useMemo } from 'react';

import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Empty,
  Icon,
  NumberSizeableText,
  Page,
  SectionList,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  type EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IBorrowHistory } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../Staking/components/PageFrame';

type IHistoryItemProps = {
  item: IBorrowHistory['list'][number] & {
    token: IBorrowHistory['tokens'][number];
    network: IBorrowHistory['networks'][number];
  };
};

const HistoryItem = ({ item }: IHistoryItemProps) => {
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowHistoryList
  >();
  const { accountId } = route.params;

  const onPress = useCallback(() => {
    navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
      networkId: item.networkId,
      accountId,
      transactionHash: item.txHash,
      historyTx: undefined,
      isAllNetworks: false,
    });
  }, [accountId, item, navigation]);

  return (
    <ListItem
      avatarProps={{
        src: item.token.info.logoURI,
        borderRadius: '$full',
        cornerImageProps: item.network.logoURI
          ? { src: item.network.logoURI }
          : undefined,
      }}
      title={item.title}
      subtitle={item.token.info.symbol}
      onPress={onPress}
    >
      <YStack>
        {item.amount ? (
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            formatterOptions={{
              showPlusMinusSigns: false,
            }}
          >
            {`${item.amount} ${item.token.info.symbol}`}
          </NumberSizeableText>
        ) : null}
      </YStack>
    </ListItem>
  );
};

type IHistorySectionItem = {
  title: string;
  data: Array<
    IBorrowHistory['list'][number] & {
      token: IBorrowHistory['tokens'][number];
      network: IBorrowHistory['networks'][number];
    }
  >;
};

type IHistoryContentProps = {
  sections: IHistorySectionItem[];
};

const keyExtractor = (
  item: IBorrowHistory['list'][number] & {
    token: IBorrowHistory['tokens'][number];
    network: IBorrowHistory['networks'][number];
  },
) => {
  const key = item?.txHash;
  return key;
};

const HistoryContent = ({ sections }: IHistoryContentProps) => {
  const renderItem = useCallback(
    ({
      item,
    }: {
      item: IBorrowHistory['list'][number] & {
        token: IBorrowHistory['tokens'][number];
        network: IBorrowHistory['networks'][number];
      };
    }) => <HistoryItem item={item} />,
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: IHistorySectionItem }) => (
      <SectionList.SectionHeader title={section.title} />
    ),
    [],
  );

  const intl = useIntl();

  return (
    <YStack flex={1}>
      <SectionList
        estimatedItemSize="$14"
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={{
          pb: '$12',
        }}
        ListEmptyComponent={
          <Empty
            pt={40}
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
    </YStack>
  );
};

function BorrowHistoryList() {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowHistoryList
  >();
  const intl = useIntl();
  const { accountId, networkId, provider, title, marketAddress } = route.params;

  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!provider || !networkId || !marketAddress) {
        return {
          sections: [],
        };
      }

      const historyResp =
        await backgroundApiProxy.serviceStaking.getBorrowHistory({
          accountId,
          networkId,
          provider,
          marketAddress,
        });

      // Create maps for quick lookup
      const networkMap = new Map(
        historyResp.networks.map((network) => [network.networkId, network]),
      );
      const tokenMap = new Map(
        historyResp.tokens.map((token) => [token.info.address, token]),
      );

      // Enrich list items with token and network data
      const enrichedList = historyResp.list.map((item) => {
        const network = networkMap.get(item.networkId);
        const token = tokenMap.get(item.tokenAddress);

        if (!network || !token) {
          console.warn(
            `Missing network or token for item: networkId=${item.networkId}, tokenAddress=${item.tokenAddress}`,
          );
        }

        return {
          ...item,
          network: network || ({} as IBorrowHistory['networks'][number]),
          token: token || ({} as IBorrowHistory['tokens'][number]),
        };
      });

      const listMap = groupBy(enrichedList, (item) =>
        formatDate(new Date(item.timestamp), { hideTimeForever: true }),
      );

      const sections: IHistorySectionItem[] = Object.entries(listMap)
        .map(([sectionTitle, data]) => ({
          title: sectionTitle,
          data,
        }))
        .sort((a, b) => b.data[0].timestamp - a.data[0].timestamp);

      return {
        sections,
      };
    },
    [accountId, networkId, provider, marketAddress],
    { watchLoading: true, pollingInterval: 30 * 1000 },
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={
          title || intl.formatMessage({ id: ETranslations.global_history })
        }
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={SimpleSpinnerSkeleton}
          error={isErrorState({ result, isLoading })}
          loading={isLoadingState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? <HistoryContent sections={result.sections} /> : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
}

export default BorrowHistoryList;
