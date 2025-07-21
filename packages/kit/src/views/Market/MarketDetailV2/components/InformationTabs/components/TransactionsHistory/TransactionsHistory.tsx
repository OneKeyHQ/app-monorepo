import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  ScrollView,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';
import { useLeftColumnWidthAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketTransactions } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketTransactions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionsSkeleton } from './components/TransactionsSkeleton';
import { TransactionItemNormal } from './layout/TransactionItemNormal/TransactionItemNormal';
import { TransactionsHeaderNormal } from './layout/TransactionItemNormal/TransactionsHeaderNormal';
import { TransactionItemSmall } from './layout/TransactionItemSmall/TransactionItemSmall';
import { TransactionsHeaderSmall } from './layout/TransactionItemSmall/TransactionsHeaderSmall';

interface ITransactionsHistoryProps {
  tokenAddress: string;
  networkId: string;
}

export function TransactionsHistory({
  tokenAddress,
  networkId,
}: ITransactionsHistoryProps) {
  const intl = useIntl();
  const { gtLg } = useMedia();
  const [leftColumnWidth] = useLeftColumnWidthAtom();
  const { transactions, isRefreshing } = useMarketTransactions({
    tokenAddress,
    networkId,
  });

  const shouldEnableScroll = leftColumnWidth < 930;

  const renderItem: IListViewProps<IMarketTokenTransaction>['renderItem'] =
    useCallback(
      ({ item }: { item: IMarketTokenTransaction }) => {
        return gtLg ? (
          <TransactionItemNormal item={item} networkId={networkId} />
        ) : (
          <TransactionItemSmall item={item} />
        );
      },
      [networkId, gtLg],
    );

  if (isRefreshing && transactions.length === 0) {
    return <TransactionsSkeleton />;
  }

  if (!isRefreshing && transactions.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_nodata,
          })}
        </SizableText>
      </Stack>
    );
  }

  const list = (
    <Stack flex={1}>
      {gtLg ? <TransactionsHeaderNormal /> : <TransactionsHeaderSmall />}
      <ListView<IMarketTokenTransaction>
        data={transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.hash}
        estimatedItemSize={40}
        showsVerticalScrollIndicator
        contentContainerStyle={{
          paddingBottom: '$4',
        }}
      />
    </Stack>
  );

  if (gtLg && shouldEnableScroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {list}
      </ScrollView>
    );
  }

  return list;
}
