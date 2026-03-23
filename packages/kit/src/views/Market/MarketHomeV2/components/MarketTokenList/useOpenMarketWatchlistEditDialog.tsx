import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  IDialogInstance,
  IDragEndParamsWithItem,
} from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  SortableListView,
  Spinner,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { TokenIdentityItem } from './components/TokenIdentityItem/TokenIdentityItem';
import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';

import type { IMarketToken } from './MarketTokenData';

const CELL_HEIGHT = 56;
const EDIT_DIALOG_HEIGHT = 480;

const getWatchlistItemLayout = (_: unknown, index: number) => ({
  length: CELL_HEIGHT,
  offset: index * CELL_HEIGHT,
  index,
});

function getWatchlistTokenKey(item: IMarketToken) {
  return item.perpsCoin
    ? `perps:${item.perpsCoin}`
    : `${item.networkId}:${(item.address || '').toLowerCase()}:${item.isNative ? 1 : 0}`;
}

function tokenToWatchListItem(token: IMarketToken): IMarketWatchListItemV2 {
  return {
    chainId: token.networkId,
    contractAddress: token.address,
    sortIndex: token.sortIndex,
    isNative: token.isNative,
    perpsCoin: token.perpsCoin,
  };
}

function MarketWatchlistEditDialogContent({
  watchlist,
  onRemove,
  onSort,
}: {
  watchlist: IMarketWatchListItemV2[];
  onRemove: (item: IMarketToken) => Promise<void>;
  onSort: (params: IDragEndParamsWithItem<IMarketToken>) => void;
}) {
  const intl = useIntl();
  const watchlistResult = useMarketWatchlistTokenList({
    watchlist,
    pageSize: 999,
  });
  const [dataSource, setDataSource] = useState<IMarketToken[]>([]);
  const removedKeysRef = useRef(new Set<string>());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const filtered = watchlistResult.data.filter(
      (item) => !removedKeysRef.current.has(getWatchlistTokenKey(item)),
    );
    setDataSource(filtered);
    if (filtered.length > 0 || !watchlistResult.isLoading) {
      isInitializedRef.current = true;
    }
  }, [watchlistResult.data, watchlistResult.isLoading]);

  const handleRemove = useCallback(
    async (item: IMarketToken) => {
      const itemKey = getWatchlistTokenKey(item);
      removedKeysRef.current.add(itemKey);
      setDataSource((prev) =>
        prev.filter(
          (currentItem) => getWatchlistTokenKey(currentItem) !== itemKey,
        ),
      );
      try {
        await onRemove(item);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.market_remove_from_watchlist,
          }),
        });
      } catch {
        removedKeysRef.current.delete(itemKey);
        setDataSource((prev) => [...prev, item]);
      }
    },
    [intl, onRemove],
  );

  const handleDragEnd = useCallback(
    (params: IDragEndParamsWithItem<IMarketToken>) => {
      const { data } = params;
      setDataSource(data);
      onSort(params);
    },
    [onSort],
  );

  if (!isInitializedRef.current && !dataSource.length) {
    return (
      <YStack
        h={EDIT_DIALOG_HEIGHT}
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="small" />
      </YStack>
    );
  }

  return (
    <YStack h={EDIT_DIALOG_HEIGHT}>
      <SortableListView
        data={dataSource}
        enabled
        keyExtractor={getWatchlistTokenKey}
        getItemLayout={getWatchlistItemLayout}
        onDragEnd={handleDragEnd}
        ListEmptyComponent={null}
        renderItem={({ item, drag, isActive }) => (
          <ListItem
            h={CELL_HEIGHT}
            minHeight={0}
            px="$0"
            mx="$0"
            py="$0"
            gap="$2"
            borderRadius="$0"
            onLongPress={drag}
            opacity={isActive ? 0.8 : 1}
          >
            <XStack pr="$1" alignItems="center" justifyContent="center">
              <Icon name="DragOutline" color="$iconSubdued" />
            </XStack>
            <YStack flex={1} minWidth={0}>
              <TokenIdentityItem
                tokenLogoURI={item.tokenImageUri}
                tokenLogoURIs={item.tokenImageUris}
                networkLogoURI={item.networkLogoUri}
                networkId={item.networkId}
                symbol={item.symbol}
                address={item.address}
                showVolume
                volume={item.turnover}
                communityRecognized={item.communityRecognized}
                stock={item.stock}
                maxLeverage={item.maxLeverage}
                perpsSubtitle={item.perpsSubtitle}
              />
            </YStack>
            <XStack gap="$1">
              <ListItem.IconButton
                title={intl.formatMessage({
                  id: ETranslations.global_remove,
                })}
                icon="DeleteOutline"
                onPress={() => {
                  void handleRemove(item);
                }}
              />
            </XStack>
          </ListItem>
        )}
      />
    </YStack>
  );
}

export function useOpenMarketWatchlistEditDialog() {
  const intl = useIntl();
  const dialogRef = useRef<IDialogInstance | null>(null);
  const [watchlistState] = useMarketWatchListV2Atom();
  const actions = useWatchListV2Actions();
  const watchlistRef = useRef<IMarketWatchListItemV2[]>([]);
  watchlistRef.current = watchlistState.data || [];

  const handleRemove = useCallback(
    async (item: IMarketToken) => {
      if (item.perpsCoin) {
        await actions.current.removePerpsFromWatchListV2(item.perpsCoin);
      } else {
        await actions.current.removeFromWatchListV2(
          item.networkId,
          item.address,
        );
      }
    },
    [actions],
  );

  const handleSort = useCallback(
    (params: IDragEndParamsWithItem<IMarketToken>) => {
      const { dragItem, prevItem, nextItem } = params;
      void actions.current.sortWatchListV2Items({
        target: tokenToWatchListItem(dragItem),
        prev: prevItem ? tokenToWatchListItem(prevItem) : undefined,
        next: nextItem ? tokenToWatchListItem(nextItem) : undefined,
      });
    },
    [actions],
  );

  useEffect(
    () => () => {
      if (dialogRef.current?.isExist()) {
        void dialogRef.current.close();
      }
      dialogRef.current = null;
    },
    [],
  );

  return useCallback(() => {
    if (dialogRef.current?.isExist()) {
      return;
    }

    dialogRef.current = Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.global_favorites,
      }),
      renderContent: (
        <MarketWatchlistEditDialogContent
          watchlist={watchlistRef.current}
          onRemove={handleRemove}
          onSort={handleSort}
        />
      ),
      estimatedContentHeight: EDIT_DIALOG_HEIGHT,
      disableDrag: true,
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_done,
      }),
      onClose: async () => {
        dialogRef.current = null;
      },
    });
  }, [handleRemove, handleSort, intl]);
}
