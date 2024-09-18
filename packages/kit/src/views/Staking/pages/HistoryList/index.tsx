import { useCallback, useMemo } from 'react';

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
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
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
import { capitalizeString } from '../../utils/utils';

type IHistoryItemProps = {
  item: IStakeHistory;
  network?: { networkId: string; name: string; logoURI: string };
  token?: IToken;
  provider?: string;
};

const HistoryItem = ({ item, provider, token }: IHistoryItemProps) => (
  <ListItem
    avatarProps={{
      src: token?.logoURI,
    }}
    title={item.title}
    subtitle={provider ? capitalizeString(provider) : undefined}
  >
    <YStack>
      {item.amount && Number(item.amount) > 0 ? (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="balance"
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

type IHistoryContentProps = {
  items: IStakeHistory[];
  network?: { networkId: string; name: string; logoURI: string };
  tokenMap: Record<string, IToken>;
  provider?: string;
};

const keyExtractor = (item: unknown) => {
  const key = (item as IStakeHistory)?.txHash;
  return key;
};

const HistoryContent = ({
  items,
  network,
  tokenMap,
  provider,
}: IHistoryContentProps) => {
  const sections = useMemo(() => {
    const result = groupBy(items, (item) =>
      formatDate(new Date(item.timestamp * 1000), { hideTimeForever: true }),
    );
    return Object.entries(result)
      .map(([title, data]) => ({ title, data }))
      .sort((a, b) => b.data[0].timestamp - a.data[0].timestamp);
  }, [items]);

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
    ({
      section,
    }: {
      section: {
        title: string;
      };
    }) => (
      <SectionList.SectionHeader
        title={section.title}
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
    EModalStakingRoutes.ProtocolDetails
  >();
  const { accountId, networkId, symbol, provider } = route.params;
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getStakeHistory({
        accountId,
        networkId,
        symbol,
        provider,
      }),
    [accountId, networkId, symbol, provider],
    { watchLoading: true },
  );
  const intl = useIntl();
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
              items={result.list}
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
