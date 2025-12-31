import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketBasicConfigToken } from '@onekeyhq/shared/types/marketV2';

import { useWatchListV2Action } from '../../../components/watchListHooksV2';

import { RecommendItem } from './RecommendItem';

interface IMarketRecommendListProps {
  recommendedTokens: IMarketBasicConfigToken[];
  maxSize?: number;
  onTokenSelect?: (token: IMarketBasicConfigToken) => void;
  enableSelection?: boolean;
}

export function MarketRecommendList({
  recommendedTokens,
  maxSize = 8,
  onTokenSelect,
  enableSelection = true,
}: IMarketRecommendListProps) {
  const intl = useIntl();
  const actions = useWatchListV2Action();
  const { height: windowHeight } = useWindowDimensions();

  const actualMaxSize = useMemo(
    () => (windowHeight < 750 ? 6 : maxSize),
    [windowHeight, maxSize],
  );

  const actualShowTitle = useMemo(() => windowHeight > 700, [windowHeight]);

  const defaultTokens = useMemo(
    () => recommendedTokens?.slice(0, actualMaxSize) || [],
    [recommendedTokens, actualMaxSize],
  );

  const [selectedTokens, setSelectedTokens] = useState<
    IMarketBasicConfigToken[]
  >(enableSelection ? defaultTokens : []);

  useEffect(() => {
    setSelectedTokens(enableSelection ? defaultTokens : []);
  }, [enableSelection, defaultTokens]);

  const handleRecommendItemChange = useCallback(
    (checked: boolean, address: string) => {
      if (!enableSelection) {
        const token = recommendedTokens.find(
          (t) => t.contractAddress === address,
        );
        if (token && onTokenSelect) {
          onTokenSelect(token);
        }
        return;
      }

      const token = recommendedTokens.find(
        (t) => t.contractAddress === address,
      );
      if (!token) return;

      setSelectedTokens((prev) =>
        checked
          ? [...prev, token]
          : prev.filter((i) => i.contractAddress !== address),
      );
    },
    [enableSelection, onTokenSelect, recommendedTokens],
  );

  const handleAddTokens = useCallback(async () => {
    if (enableSelection) {
      const items = selectedTokens.map((token) => ({
        chainId: token.chainId,
        contractAddress: token.contractAddress,
        isNative: token.isNative,
      }));

      actions.addIntoWatchListV2(items);

      // Log analytics for each token added to watchlist from recommend list
      selectedTokens.forEach((token) => {
        defaultLogger.dex.watchlist.dexAddToWatchlist({
          network: token.chainId,
          tokenSymbol: token.symbol || '',
          tokenContract: token.contractAddress,
          addFrom: EWatchlistFrom.Recommend,
        });
      });

      setTimeout(() => {
        setSelectedTokens(defaultTokens);
      }, 50);
    }
  }, [actions, selectedTokens, defaultTokens, enableSelection]);

  const confirmButton = useMemo(
    () =>
      enableSelection ? (
        <Button
          width="100%"
          size="large"
          disabled={!selectedTokens.length}
          variant="primary"
          onPress={handleAddTokens}
        >
          {intl.formatMessage(
            {
              id: ETranslations.market_add_number_tokens,
            },
            { number: selectedTokens.length || 0 },
          )}
        </Button>
      ) : null,
    [selectedTokens.length, handleAddTokens, intl, enableSelection],
  );

  if (!recommendedTokens?.length) {
    return null;
  }

  return (
    <YStack p="$5" jc="center" ai="center" width="100%">
      {actualShowTitle ? (
        <>
          <SizableText
            size={platformEnv.isExtensionUiPopup ? '$headingXl' : '$heading3xl'}
            color="$text"
          >
            {intl.formatMessage({
              id: ETranslations.market_favorites_empty,
            })}
          </SizableText>
          <SizableText
            color="$textSubdued"
            size={platformEnv.isExtensionUiPopup ? '$bodyMd' : '$bodyLg'}
            pt="$2"
          >
            {intl.formatMessage({
              id: ETranslations.market_favorites_empty_desc,
            })}
          </SizableText>
        </>
      ) : null}
      <YStack
        pt={actualShowTitle ? '$8' : '$0'}
        gap="$2.5"
        flexWrap="wrap"
        width="100%"
        $gtMd={{ maxWidth: 480 }}
        $sm={{
          gap: '$2',
        }}
      >
        {new Array(Math.ceil(actualMaxSize / 2)).fill(0).map((_, i) => (
          <XStack
            gap="$2.5"
            key={i}
            $sm={{
              gap: '$2',
            }}
          >
            {new Array(2).fill(0).map((__, j) => {
              const item = recommendedTokens?.[i * 2 + j];
              console.log('item', item);
              return item ? (
                <RecommendItem
                  key={item.contractAddress}
                  address={item.contractAddress}
                  checked={
                    enableSelection
                      ? selectedTokens.some(
                          (t) => t.contractAddress === item.contractAddress,
                        )
                      : false
                  }
                  icon={item.logo || ''}
                  symbol={item.symbol}
                  tokenName={item.name}
                  networkId={item.chainId}
                  onChange={handleRecommendItemChange}
                />
              ) : null;
            })}
          </XStack>
        ))}
        <YStack pt="$8">{confirmButton}</YStack>
      </YStack>
    </YStack>
  );
}
