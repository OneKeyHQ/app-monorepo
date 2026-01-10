import { useCallback, useMemo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  getHyperliquidTokenImageUrl,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IUniversalSearchPerp } from '@onekeyhq/shared/types/search';

interface IUniversalSearchPerpItemProps {
  item: IUniversalSearchPerp;
}

export function UniversalSearchPerpItem({
  item,
}: IUniversalSearchPerpItemProps) {
  const navigation = useAppNavigation();
  const universalSearchActions = useUniversalSearchActions();
  const { coin, price } = item.payload;

  const { displayName, dexLabel } = useMemo(() => parseDexCoin(coin), [coin]);

  const tokenImageUri = useMemo(
    () => getHyperliquidTokenImageUrl(displayName),
    [displayName],
  );

  const handlePress = useCallback(() => {
    setTimeout(async () => {
      // Navigate to Perp tab first
      navigation.switchTab(ETabRoutes.Perp);

      // Then change the active asset
      try {
        await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
          coin,
        });
      } catch (error) {
        console.error('Failed to change active asset:', error);
      }

      // Add to recent search list
      setTimeout(() => {
        universalSearchActions.current.addIntoRecentSearchList({
          id: `perp-${coin}`,
          text: displayName,
          type: item.type,
          timestamp: Date.now(),
          extra: {
            coin,
            ...(dexLabel ? { dexLabel } : {}),
          },
        });
      }, 10);
    }, 80);
  }, [
    coin,
    displayName,
    dexLabel,
    item.type,
    navigation,
    universalSearchActions,
  ]);

  return (
    <ListItem
      jc="space-between"
      onPress={handlePress}
      renderAvatar={
        <Token
          size="lg"
          borderRadius="$full"
          tokenImageUri={tokenImageUri}
          fallbackIcon="CryptoCoinOutline"
        />
      }
    >
      <ListItem.Text
        flex={1}
        primary={
          <XStack alignItems="center" gap="$1">
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              maxWidth="$60"
              flexShrink={1}
            >
              {displayName}
            </SizableText>
            {dexLabel ? (
              <XStack
                borderRadius="$1"
                bg="$bgInfo"
                justifyContent="center"
                alignItems="center"
                px="$1.5"
              >
                <SizableText
                  fontSize={10}
                  alignSelf="center"
                  color="$textInfo"
                  lineHeight={16}
                >
                  {dexLabel}
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
        }
        secondary={
          <SizableText size="$bodyMd" color="$textSubdued">
            {`${displayName} - USDC`}
          </SizableText>
        }
      />
      <YStack alignItems="flex-end">
        <NumberSizeableText
          formatter="price"
          size="$bodyLgMedium"
          color="$text"
        >
          {price}
        </NumberSizeableText>
      </YStack>
    </ListItem>
  );
}
