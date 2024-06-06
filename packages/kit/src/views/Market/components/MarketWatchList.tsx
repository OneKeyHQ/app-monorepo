import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  Icon,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IMarketCategory } from '@onekeyhq/shared/types/market';

import { useMarketWatchListAtom } from '../../../states/jotai/contexts/market';

import { MarketHomeList } from './MarketHomeList';
import { useWatchListAction } from './wachListHooks';

function RecommendItem({
  icon,
  checked = false,
  onChange,
  tokenName,
  symbol,
  coingeckoId,
}: {
  icon: string;
  tokenName: string;
  checked: boolean;
  symbol: string;
  coingeckoId: string;
  onChange: (checked: boolean, coingeckoId: string) => void;
}) {
  return (
    <XStack
      cursor="pointer"
      flexGrow={1}
      flexBasis={0}
      justifyContent="space-between"
      px="$4"
      py="$3.5"
      bg="$bgSubdued"
      borderColor="$borderSubdued"
      borderWidth="$px"
      borderRadius="$3"
      onPress={() => {
        onChange(!checked, coingeckoId);
      }}
      ai="center"
    >
      <XStack space="$3" ai="center" flexShrink={1}>
        <Image src={decodeURIComponent(icon)} size="$8" borderRadius="$full" />
        <YStack flexShrink={1}>
          <SizableText
            selectable={false}
            size="$bodyLgMedium"
            numberOfLines={1}
          >
            {symbol.toUpperCase()}
          </SizableText>
          <SizableText
            selectable={false}
            size="$bodyMd"
            color="$textSubdued"
            flexShrink={1}
            numberOfLines={1}
          >
            {tokenName}
          </SizableText>
        </YStack>
      </XStack>
      {checked ? (
        <Icon name="CheckRadioSolid" size="$6" color="$iconActive" />
      ) : (
        <Stack w="$6" h="$6" />
      )}
    </XStack>
  );
}

const maxSize = 8;
export function MarketWatchList({ category }: { category: IMarketCategory }) {
  const [{ data: watchListCoingeckoIds, loading }] = useMarketWatchListAtom();

  const actions = useWatchListAction();

  const defaultCoingeckoIds = useMemo(
    () =>
      category?.recommendedTokens
        ?.slice(0, maxSize)
        ?.map((i) => i.coingeckoId) || [],
    [category.recommendedTokens],
  );
  const [coingeckoIds, setCoingeckoIds] =
    useState<string[]>(defaultCoingeckoIds);

  const handleRecommendItemChange = useCallback(
    (checked: boolean, coingeckoId: string) => {
      setCoingeckoIds((prev) =>
        checked
          ? [...prev, coingeckoId]
          : prev.filter((i) => i !== coingeckoId),
      );
    },
    [],
  );

  const handleAddTokens = useCallback(() => {
    actions.addIntoWatchList(coingeckoIds);
  }, [actions, coingeckoIds]);

  const { gtMd } = useMedia();
  const confirmButton = useMemo(
    () => (
      <Button
        width="100%"
        size="large"
        disabled={!coingeckoIds.length}
        variant="primary"
        onPress={handleAddTokens}
      >
        {coingeckoIds.length
          ? `Add ${coingeckoIds.length} tokens`
          : 'Add tokens'}
      </Button>
    ),
    [coingeckoIds.length, handleAddTokens],
  );
  const renderRecommend = useCallback(() => {
    if (category?.recommendedTokens) {
      return (
        <>
          <ScrollView contentContainerStyle={{ ai: 'center' }} px="$5" py="$8">
            <SizableText size="$heading3xl">
              Your watchlist is empty
            </SizableText>
            <SizableText size="$bodyLgMedium" pt="$2">
              Add your favorite tokens to watchlist
            </SizableText>
            <YStack
              pt="$8"
              space="$2.5"
              flexWrap="wrap"
              width="100%"
              $gtMd={{ maxWidth: 480 }}
            >
              {new Array(Math.ceil(maxSize / 2)).fill(0).map((_, i) => (
                <XStack space="$2.5" key={i}>
                  {new Array(2).fill(0).map((__, j) => {
                    const item = category.recommendedTokens?.[i * 2 + j];
                    return item ? (
                      <RecommendItem
                        key={item.coingeckoId}
                        coingeckoId={item.coingeckoId}
                        checked={coingeckoIds.includes(item.coingeckoId)}
                        icon={item.iconUrl}
                        symbol={item.symbol}
                        tokenName={item.name}
                        onChange={handleRecommendItemChange}
                      />
                    ) : null;
                  })}
                </XStack>
              ))}
              {gtMd ? <YStack mt="$8">{confirmButton}</YStack> : null}
            </YStack>
          </ScrollView>
          {gtMd ? null : <YStack p="$5">{confirmButton}</YStack>}
        </>
      );
    }
    return null;
  }, [
    category.recommendedTokens,
    coingeckoIds,
    confirmButton,
    gtMd,
    handleRecommendItemChange,
  ]);
  if (loading) {
    return null;
  }
  return watchListCoingeckoIds?.length === 0 ? (
    renderRecommend()
  ) : (
    <MarketHomeList
      showMoreAction={gtMd}
      category={
        {
          categoryId: 'all',
          coingeckoIds: watchListCoingeckoIds?.map(
            ({ coingeckoId }) => coingeckoId,
          ),
        } as IMarketCategory
      }
    />
  );
}
