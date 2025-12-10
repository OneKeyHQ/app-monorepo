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

import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../Staking/components/PageFrame';

type IBorrowHistoryItem = {
  networkId: string;
  txHash: string;
  title: string;
  amount: string;
  tokenAddress: string;
  timestamp: number;
};

type IHistoryItemProps = {
  item: IBorrowHistoryItem;
  networkId?: string;
};

const HistoryItem = ({ item, networkId }: IHistoryItemProps) => {
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
        src: undefined,
        fallbackProps: {
          w: '$10',
          h: '$10',
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="GlobusOutline" />,
        },
      }}
      title={item.title}
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
            {item.amount}
          </NumberSizeableText>
        ) : null}
      </YStack>
    </ListItem>
  );
};

type IHistorySectionItem = {
  title: string;
  data: IBorrowHistoryItem[];
};

type IHistoryContentProps = {
  sections: IHistorySectionItem[];
  networkId?: string;
};

const keyExtractor = (item: unknown) => {
  const key = (item as IBorrowHistoryItem)?.txHash;
  return key;
};

const HistoryContent = ({ sections, networkId }: IHistoryContentProps) => {
  const renderItem = useCallback(
    ({ item }: { item: IBorrowHistoryItem }) => (
      <HistoryItem item={item} networkId={networkId} />
    ),
    [networkId],
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

      const listMap = groupBy(historyResp.list, (item) =>
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
          {result ? (
            <HistoryContent sections={result.sections} networkId={networkId} />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
}

export default BorrowHistoryList;
