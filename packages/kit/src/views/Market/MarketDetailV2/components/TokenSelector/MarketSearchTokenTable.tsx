import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Stack, Table } from '@onekeyhq/components';
import { useMarketTokenColumns } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenColumns';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import { TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS } from './constants';

function convertSearchTokenToMarketToken(
  item: IMarketSearchV2Token & { networkLogoURI: string },
): IMarketToken {
  return {
    id: `${item.network}_${item.address}`,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    decimals: item.decimals,
    price: Number(item.price) || 0,
    change24h: Number(item.priceChange24hPercent) || 0,
    marketCap: Number(item.marketCap) || 0,
    liquidity: Number(item.liquidity) || 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: Number(item.volume_24h || item.volume24h) || 0,
    tokenImageUri: item.logoUrl,
    tokenImageUris: item.logoUrls,
    networkLogoUri: item.networkLogoURI,
    networkId: item.network,
    chainId: item.network,
    isNative: item.isNative,
    communityRecognized: item.communityRecognized,
    stock: item.stock,
  };
}

function MarketSearchTokenTable({
  items,
  onPress,
  isLoading,
}: {
  items: (IMarketSearchV2Token & { networkLogoURI: string })[];
  onPress: (item: IMarketToken) => void;
  isLoading?: boolean;
}) {
  const intl = useIntl();

  const columns = useMarketTokenColumns(
    undefined, // networkId
    false, // isWatchlistMode
    true, // hideTokenAge
    EWatchlistFrom.Search, // watchlistFrom
    undefined, // copyFrom
    true, // hasStock
    true, // showStockSubtitle
    TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS, // hiddenDesktopColumns
  );

  const data = useMemo(
    () => items.map(convertSearchTokenToMarketToken),
    [items],
  );

  const onRow = useCallback(
    (item: IMarketToken) => ({
      onPress: () => onPress(item),
    }),
    [onPress],
  );

  if (isLoading) {
    return <Table.Skeleton columns={columns} count={10} />;
  }

  if (data.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Empty
          illustration="QuestionMark"
          title={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      </Stack>
    );
  }

  return (
    <Stack flex={1}>
      <Table<IMarketToken>
        stickyHeader
        columns={columns}
        dataSource={data}
        keyExtractor={(item) => item.id}
        estimatedItemSize={60}
        onRow={onRow}
      />
    </Stack>
  );
}

const MemoMarketSearchTokenTable = memo(MarketSearchTokenTable);
export { MemoMarketSearchTokenTable as MarketSearchTokenTable };
