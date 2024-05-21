import { useCallback, useState } from 'react';

import {
  Button,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketWatchListPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketCategory } from '@onekeyhq/shared/types/market';

import { MarketHomeList } from './MarketHomeList';

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
        <Image src={decodeURIComponent(icon)} size="$8" borderRadius="100%" />
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
  const [{ items: watchListCoingeckoIds }] = useMarketWatchListPersistAtom();

  const { result: listData } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceMarket.fetchCategory(
        category.categoryId,
        category.coingeckoIds,
        true,
      ),
    [category.categoryId, category.coingeckoIds],
  );

  const [coingeckoIds, setCoingeckoIds] = useState<string[]>([]);

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

  const handleAddTokens = useCallback(async () => {
    await backgroundApiProxy.serviceMarket.addIntoWatchList(
      coingeckoIds.map((coingeckoId) => ({
        coingeckoId,
      })),
    );
  }, [coingeckoIds]);

  const renderRecommend = useCallback(() => {
    if (listData?.length) {
      return (
        <YStack flex={1} ai="center" jc="center" px="$5" py="$8">
          <SizableText size="$heading3xl">Your watchlist is empty</SizableText>
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
                  const item = listData[i * 2 + j];
                  return (
                    <RecommendItem
                      key={item.coingeckoId}
                      coingeckoId={item.coingeckoId}
                      checked={coingeckoIds.includes(item.coingeckoId)}
                      icon={item.image}
                      symbol={item.symbol}
                      tokenName={item.name}
                      onChange={handleRecommendItemChange}
                    />
                  );
                })}
              </XStack>
            ))}
            <Button
              mt="$8"
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
          </YStack>
        </YStack>
      );
    }
    return null;
  }, [coingeckoIds, handleAddTokens, handleRecommendItemChange, listData]);
  return watchListCoingeckoIds?.length === 0 ? (
    renderRecommend()
  ) : (
    <MarketHomeList
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
