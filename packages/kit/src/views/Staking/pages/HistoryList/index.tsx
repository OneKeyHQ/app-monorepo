import { useCallback, useMemo, useState } from 'react';

import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Empty,
  Icon,
  IconButton,
  NumberSizeableText,
  Page,
  SectionList,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  type EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IStakeHistoriesResponse,
  IStakeHistory,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { EarnAlert } from '../../components/ProtocolDetails/EarnAlert';
import { useEarnTxLabel } from '../../hooks/useEarnTxLabel';
import { capitalizeString } from '../../utils/utils';

type IHistoryItemProps = {
  item: IStakeHistory;
  network?: { networkId: string; name: string; logoURI: string };
  networks?: IStakeHistoriesResponse['networks'];
  token?: IToken;
  provider?: string;
  tokenMap?: IStakeHistoriesResponse['tokenMap'];
};

const HistoryItem = ({
  item,
  provider,
  token,
  network,
  networks,
  tokenMap,
}: IHistoryItemProps) => {
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.HistoryList
  >();
  const { accountId, filterType } = route.params;

  const { result: accountAddress } = usePromiseResult(async () => {
    return network?.networkId
      ? backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          networkId: network.networkId,
          accountId,
        })
      : '';
  }, [network?.networkId, accountId]);
  const logoURI = useMemo(() => {
    if (token?.logoURI) {
      return token.logoURI;
    }
    if (networks?.length) {
      return networks.find((o) => o.networkId === item.networkId)?.logoURI;
    }
    if (tokenMap && item.type === 'stake') {
      const uri = tokenMap[item.tokenAddress]?.logoURI;
      if (uri) {
        return uri;
      }
    }
    return network?.logoURI;
  }, [
    item.type,
    item.tokenAddress,
    item.networkId,
    token?.logoURI,
    networks,
    network?.logoURI,
    tokenMap,
  ]);
  const onPress = useCallback(() => {
    navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
      networkId: item.networkId,
      accountId,
      transactionHash: item.txHash,
      historyTx: undefined,
      isAllNetworks: false,
    });
  }, [accountId, item, navigation]);
  const subtitle = useMemo(() => {
    if (filterType === 'rebate') {
      return (
        <XStack gap="$1.5" ai="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {accountUtils.shortenAddress({
              address: accountAddress,
              leadingLength: 6,
              trailingLength: 6,
            })}
          </SizableText>
          <IconButton
            icon="OpenOutline"
            size="small"
            variant="tertiary"
            onPress={() => {
              void openExplorerAddressUrl({
                networkId: network?.networkId,
                address: accountAddress,
                openInExternal: true,
              });
            }}
          />
        </XStack>
      );
    }
    if (provider) {
      return capitalizeString(provider);
    }
    return undefined;
  }, [accountAddress, filterType, network?.networkId, provider]);
  return (
    <ListItem
      avatarProps={{
        src: logoURI,
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
      subtitle={subtitle}
      onPress={onPress}
    >
      <YStack>
        {item.amount !== undefined ? (
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            color={item.direction === 'receive' ? '$textSuccess' : undefined}
            formatterOptions={{
              tokenSymbol: token?.symbol,
              showPlusMinusSigns: true,
            }}
          >
            {`${item.direction === 'send' ? '-' : ''}${item.amount}`}
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
  filter: Record<string, string>;
  sections: IHistorySectionItem[];
  filterType?: string;
  onFilterTypeChange: (type: string) => void;
  network?: { networkId: string; name: string; logoURI: string };
  networks?: IStakeHistoriesResponse['networks'];
  tokenMap?: IStakeHistoriesResponse['tokenMap'];
  provider?: string;
};

const keyExtractor = (item: unknown) => {
  const key = (item as IStakeHistory)?.txHash;
  return key;
};

const HistoryContent = ({
  sections,
  network,
  provider,
  filter,
  filterType,
  networks,
  tokenMap,
  onFilterTypeChange,
}: IHistoryContentProps) => {
  const renderItem = useCallback(
    ({ item }: { item: IStakeHistory }) => (
      <HistoryItem
        item={item}
        network={network}
        token={item.token?.info}
        tokenMap={tokenMap}
        provider={provider}
        networks={networks}
      />
    ),
    [network, networks, provider, tokenMap],
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

  const items = useMemo(() => {
    const keys = Object.keys(filter);
    return keys.map((key) => ({
      label: filter[key],
      value: key,
    }));
  }, [filter]);

  const handleSelectChange = useCallback(
    (v: string) => {
      onFilterTypeChange(v);
    },
    [onFilterTypeChange],
  );

  return (
    <YStack flex={1}>
      <XStack px="$5">
        <Select
          value={filterType}
          renderTrigger={({ label }) => (
            <XStack h="$12" ai="center" gap="$1">
              <Icon name="Filter2Outline" size="$4" mr="$1" />
              <SizableText size="$bodyMd" color="$textSubdued">
                {label}
              </SizableText>
              <Icon name="ChevronDownSmallOutline" size="$4" />
            </XStack>
          )}
          items={items}
          onChange={handleSelectChange}
          title={intl.formatMessage({ id: ETranslations.global_filter_by })}
        />
      </XStack>
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
function HistoryList() {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.HistoryList
  >();
  const intl = useIntl();
  const labelFn = useEarnTxLabel();
  const {
    accountId,
    networkId,
    symbol,
    provider,
    stakeTag,
    protocolVault,
    title,
    alerts,
    filterType: defaultFilterType,
  } = route.params;
  const [filterType, setFilterType] = useState(defaultFilterType || 'all');
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      // remote history items
      const historyResp =
        await backgroundApiProxy.serviceStaking.getStakeHistory({
          accountId,
          networkId,
          symbol,
          provider,
          protocolVault,
          type: filterType,
        });
      const listMap = groupBy(historyResp.list, (item) =>
        formatDate(new Date(item.timestamp * 1000), { hideTimeForever: true }),
      );
      const sections: {
        title: string;
        data: IStakeHistory[];
      }[] = Object.entries(listMap)
        .map(([sectionTitle, data]) => ({
          title: sectionTitle,
          data: data.map((i) => ({
            ...i,
            token: historyResp.tokens.find(
              (token) =>
                token?.info?.address === i.tokenAddress &&
                token?.info?.networkId === i.networkId,
            ),
          })),
        }))
        .sort((a, b) => b.data[0].timestamp - a.data[0].timestamp);

      // local history items
      if (filterType !== 'rebate' && stakeTag) {
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
        const localNormalizedItems = localItems.map<IStakeHistory>((o) => {
          const action = o.stakingInfo.send ?? o.stakingInfo.receive;
          return {
            txHash: o.decodedTx.txid,
            timestamp: o.decodedTx.createdAt ?? o.decodedTx.updatedAt ?? 0,
            title: labelFn(o.stakingInfo.label),
            direction: o.stakingInfo.send ? 'send' : 'receive',
            amount: action?.amount,
            networkId: o.stakingInfo?.receive?.token?.networkId ?? '',
            token: historyResp.tokens.find(
              (i) =>
                i?.info?.address === o.stakingInfo?.receive?.token?.address &&
                i?.info?.networkId === o.stakingInfo?.receive?.token?.networkId,
            ),
            tokenAddress: action?.token.address ?? '',
          };
        });
        if (localNormalizedItems.length > 0) {
          let direction = '';
          if (filterType === 'stake') {
            direction = 'send';
          } else if (filterType === 'withdraw') {
            direction = 'receive';
          }
          const pendingItems =
            filterType === 'all'
              ? localNormalizedItems
              : localNormalizedItems.filter(
                  (item) => item.direction === direction,
                );
          if (pendingItems.length > 0) {
            sections.unshift({
              title: intl.formatMessage({ id: ETranslations.global_pending }),
              data: localNormalizedItems,
              isPending: true,
            } as IHistorySectionItem);
          }
        }
      }
      return {
        network: historyResp.network,
        networks: historyResp.networks,
        tokenMap: historyResp.tokenMap,
        sections,
        filter: historyResp.filter || {},
      };
    },
    [
      accountId,
      networkId,
      symbol,
      provider,
      protocolVault,
      filterType,
      stakeTag,
      labelFn,
      intl,
    ],
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
          <XStack px="$5">
            <EarnAlert alerts={alerts} />
          </XStack>
          {result ? (
            <HistoryContent
              sections={result.sections}
              network={result.network}
              networks={result.networks}
              tokenMap={result.tokenMap}
              filter={result.filter}
              provider={provider}
              onFilterTypeChange={setFilterType}
              filterType={filterType}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
}

export default HistoryList;
