import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePerpsAllAssetsFilteredAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpTokenFavoritesPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

type IQuickAddToken = {
  symbol: string;
  coinName: string;
  label: string;
};

const QUICK_ADD_TOKENS: IQuickAddToken[] = [
  { symbol: 'BTC', coinName: 'BTC', label: 'BTCUSDC' },
  { symbol: 'ETH', coinName: 'ETH', label: 'ETHUSDC' },
  { symbol: 'BNB', coinName: 'BNB', label: 'BNBUSDC' },
  { symbol: 'SOL', coinName: 'SOL', label: 'SOLUSDC' },
  { symbol: 'HYPE', coinName: 'HYPE', label: 'HYPEUSDC' },
  { symbol: 'XRP', coinName: 'XRP', label: 'XRPUSDC' },
];

export function FavoritesEmptyState({ isMobile }: { isMobile?: boolean }) {
  const [favorites, setFavorites] = usePerpTokenFavoritesPersistAtom();
  const [{ assetsByDex }] = usePerpsAllAssetsFilteredAtom();
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const intl = useIntl();
  const handleToggleToken = useCallback((coinName: string) => {
    setSelectedTokens((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(coinName)) {
        newSet.delete(coinName);
      } else {
        newSet.add(coinName);
      }
      return newSet;
    });
  }, []);

  const handleAddToFavorites = useCallback(() => {
    if (selectedTokens.size === 0) return;

    const assetsByDexTyped: IPerpsUniverse[][] = assetsByDex || [];
    const tokensToAdd: string[] = [];

    selectedTokens.forEach((coinName) => {
      for (const assets of assetsByDexTyped) {
        const foundAsset = assets.find((a) => a.name === coinName);
        if (foundAsset && !favorites.favorites.includes(foundAsset.name)) {
          tokensToAdd.push(foundAsset.name);
          break;
        }
      }
    });

    if (tokensToAdd.length > 0) {
      setFavorites((prev) => ({
        favorites: [...prev.favorites, ...tokensToAdd],
      }));

      // Clear selection after adding to favorites
      setSelectedTokens(new Set());
    }
  }, [selectedTokens, assetsByDex, favorites.favorites, setFavorites]);

  return (
    <YStack flex={1} gap="$3" alignItems="center">
      <XStack px="$4" py="$4" gap="$2.5" flexWrap="wrap" width="100%">
        {QUICK_ADD_TOKENS.map((token) => {
          const isSelected = selectedTokens.has(token.coinName);
          return (
            <XStack
              key={token.coinName}
              flex={1}
              minWidth="48%"
              maxWidth="48%"
              px="$4"
              py="$3"
              bg="$bg"
              borderRadius="$3"
              borderWidth="$px"
              borderColor={isSelected ? '$borderActive' : '$borderSubdued'}
              justifyContent="space-between"
              alignItems="center"
              onPress={() => handleToggleToken(token.coinName)}
              cursor="pointer"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
            >
              <XStack gap="$3" alignItems="center">
                <Token
                  size="sm"
                  borderRadius="$full"
                  tokenImageUri={getHyperliquidTokenImageUrl(token.symbol)}
                  fallbackIcon="CryptoCoinOutline"
                />
                <YStack>
                  <SizableText size="$bodySmMedium" color="$text">
                    {token.label}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    PERPS
                  </SizableText>
                </YStack>
              </XStack>
              <Stack
                width={16}
                height={16}
                borderRadius="$1"
                borderWidth="$px"
                borderColor={isSelected ? '$borderActive' : '$borderSubdued'}
                bg={isSelected ? '$bgPrimary' : '$bg'}
                justifyContent="center"
                alignItems="center"
              >
                {isSelected ? (
                  <Icon
                    name="CheckLargeOutline"
                    size="$2.5"
                    color="$iconInverse"
                  />
                ) : null}
              </Stack>
            </XStack>
          );
        })}
      </XStack>

      <YStack
        px="$4"
        pb="$4"
        width={isMobile ? '100%' : 260}
        alignItems="center"
        justifyContent="center"
      >
        <Button
          size="medium"
          variant="primary"
          onPress={handleAddToFavorites}
          disabled={selectedTokens.size === 0}
          {...(isMobile ? { width: '100%' } : {})}
        >
          {intl.formatMessage({ id: ETranslations.market_add_to_favorites })}
        </Button>
      </YStack>
    </YStack>
  );
}
