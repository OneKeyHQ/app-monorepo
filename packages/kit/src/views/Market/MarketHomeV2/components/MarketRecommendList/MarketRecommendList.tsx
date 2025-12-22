import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
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
  showTitle?: boolean;
  showAddButton?: boolean;
}

export function MarketRecommendList({
  recommendedTokens,
  maxSize = 8,
  onTokenSelect,
  enableSelection = true,
  showTitle = true,
  showAddButton = true,
}: IMarketRecommendListProps) {
  const intl = useIntl();
  const actions = useWatchListV2Action();
  const { gtMd } = useMedia();

  const defaultTokens = useMemo(
    () => recommendedTokens?.slice(0, maxSize) || [],
    [recommendedTokens, maxSize],
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
    if (showAddButton && enableSelection) {
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
  }, [actions, selectedTokens, defaultTokens, showAddButton, enableSelection]);

  const confirmButton = useMemo(
    () =>
      showAddButton && enableSelection ? (
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
    [
      selectedTokens.length,
      handleAddTokens,
      intl,
      showAddButton,
      enableSelection,
    ],
  );

  const stackPaddingBottom = useMemo(() => {
    if (platformEnv.isNativeAndroid) return 80;
    if (platformEnv.isExtension) return 50;
    if (platformEnv.isWeb && !gtMd) return 50;
    return 0;
  }, [gtMd]);

  if (!recommendedTokens?.length) {
    return null;
  }

  return (
    <Stack flex={1} width="100%" paddingBottom={stackPaddingBottom}>
      <ScrollView
        contentContainerStyle={{ ai: 'center' }}
        px="$5"
        display="flex"
        py={platformEnv.isExtensionUiPopup ? '$5' : '$8'}
      >
        {showTitle ? (
          <>
            <SizableText
              size={
                platformEnv.isExtensionUiPopup ? '$headingXl' : '$heading3xl'
              }
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
          pt={showTitle ? '$8' : '$0'}
          gap="$2.5"
          flexWrap="wrap"
          width="100%"
          $gtMd={{ maxWidth: 480 }}
          $sm={{
            gap: '$2',
          }}
        >
          {new Array(Math.ceil(maxSize / 2)).fill(0).map((_, i) => (
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
      </ScrollView>
    </Stack>
  );
}
