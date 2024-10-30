import { useCallback } from 'react';

import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Empty,
  NumberSizeableText,
  Page,
  SectionList,
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
import type { IStakeHistory } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { useEarnTxLabel } from '../../hooks/useEarnTxLabel';
import { capitalizeString } from '../../utils/utils';

type IHistoryItemProps = {
  item: IStakeHistory;
  network?: { networkId: string; name: string; logoURI: string };
  token?: IToken;
  provider?: string;
};

const HistoryItem = ({ item, provider, token }: IHistoryItemProps) => {
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.HistoryList
  >();
  const { accountId, networkId } = route.params;
  const onPress = useCallback(() => {
    navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
      networkId,
      accountId,
      transactionHash: item.txHash,
      historyTx: undefined,
      isAllNetworks: false,
    });
  }, [accountId, networkId, item, navigation]);
  return (
    <ListItem
      avatarProps={{
        src: token?.logoURI,
      }}
      title={item.title}
      subtitle={provider ? capitalizeString(provider) : undefined}
      onPress={onPress}
    >
      <YStack>
        {item.amount && Number(item.amount) > 0 ? (
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            color={item.direction === 'receive' ? '$textSuccess' : undefined}
            formatterOptions={{
              tokenSymbol: token?.symbol,
              showPlusMinusSigns: true,
            }}
          >
            {`${item.direction === 'send' ? '-' : '+'}${item.amount}`}
          </NumberSizeableText>
        ) : null}
      </YStack>
    </ListItem>
  );
};

type IHistorySectionItem = {
  title: string;
  data: IStakeHistory[];
  isPending?: boolean;
};

type IHistoryContentProps = {
  sections: IHistorySectionItem[];
  network?: { networkId: string; name: string; logoURI: string };
  tokenMap: Record<string, IToken>;
  provider?: string;
};

const keyExtractor = (item: unknown) => {
  const key = (item as IStakeHistory)?.txHash;
  return key;
};

const HistoryContent = ({
  sections,
  network,
  tokenMap,
  provider,
}: IHistoryContentProps) => {
  const renderItem = useCallback(
    ({ item }: { item: IStakeHistory }) => (
      <HistoryItem
        item={item}
        network={network}
        token={tokenMap[item.tokenAddress]}
        provider={provider}
      />
    ),
    [network, tokenMap, provider],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: IHistorySectionItem }) => (
      <SectionList.SectionHeader
        title={section.title}
        titleProps={{ color: section.isPending ? '$textCaution' : undefined }}
        justifyContent="space-between"
      />
    ),
    [],
  );

  const intl = useIntl();

  return (
    <SectionList
      estimatedItemSize="$14"
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={keyExtractor}
      ListEmptyComponent={
        <Empty
          pt="$46"
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
  );
};

const HistoryList = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.HistoryList
  >();
  const intl = useIntl();
  const labelFn = useEarnTxLabel();
  const { accountId, networkId, symbol, provider, stakeTag } = route.params;
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      // remote history items
      const historyResp =
        await backgroundApiProxy.serviceStaking.getStakeHistory({
          accountId,
          networkId,
          symbol,
          provider,
        });
      const listMap = groupBy(historyResp.list, (item) =>
        formatDate(new Date(item.timestamp * 1000), { hideTimeForever: true }),
      );
      const sections = Object.entries(listMap)
        .map(([title, data]) => ({ title, data }))
        .sort((a, b) => b.data[0].timestamp - a.data[0].timestamp);

      const tokenMap = { ...historyResp.tokenMap };

      // local history items
      if (stakeTag) {
        // refresh account history
        await backgroundApiProxy.serviceHistory.fetchAccountHistory({
          accountId,
          networkId,
        });
        const localItems =
          await backgroundApiProxy.serviceStaking.fetchLocalStakingHistory({
            accountId,
            networkId,
            stakeTag,
          });
        localItems.forEach((o) => {
          if (o.stakingInfo.receive) {
            const receive = o.stakingInfo.receive;
            tokenMap[receive.token.address] = receive.token;
          }
          if (o.stakingInfo.send) {
            const send = o.stakingInfo.send;
            tokenMap[send.token.address] = send.token;
          }
        });
        const localNormalizedItems = localItems.map<IStakeHistory>((o) => {
          const action = o.stakingInfo.send ?? o.stakingInfo.receive;
          return {
            txHash: o.decodedTx.txid,
            timestamp: o.decodedTx.createdAt ?? o.decodedTx.updatedAt ?? 0,
            title: labelFn(o.stakingInfo.label),
            direction: o.stakingInfo.send ? 'send' : 'receive',
            amount: action?.amount,
            tokenAddress: action?.token.address ?? '',
          };
        });
        if (localNormalizedItems.length > 0) {
          sections.unshift({
            title: intl.formatMessage({ id: ETranslations.global_pending }),
            data: localNormalizedItems,
            isPending: true,
          } as IHistorySectionItem);
        }
      }
      return { network: historyResp.network, sections, tokenMap };
    },
    [accountId, networkId, symbol, provider, stakeTag, labelFn, intl],
    { watchLoading: true, pollingInterval: 30 * 1000 },
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_history })}
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={SimpleSpinnerSkeleton}
          error={isErrorState({ result, isLoading })}
          loading={isLoadingState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? (
            <HistoryContent
              sections={result.sections}
              network={result.network}
              tokenMap={result.tokenMap}
              provider={provider}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default HistoryList;
