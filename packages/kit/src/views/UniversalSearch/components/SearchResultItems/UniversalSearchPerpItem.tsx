import { useCallback, useMemo } from 'react';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { XYZ_DEX_PREFIX } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IUniversalSearchPerp } from '@onekeyhq/shared/types/search';

interface IUniversalSearchPerpItemProps {
  item: IUniversalSearchPerp;
}

export function UniversalSearchPerpItem({
  item,
}: IUniversalSearchPerpItemProps) {
  const navigation = useAppNavigation();
  const universalSearchActions = useUniversalSearchActions();
  const { assetType, logoUrl, name, maxLeverage, midPx, subtitle } =
    item.payload;

  const isPerpsType = assetType === 'perps';
  // For perps type, coin is just name; for xyz type, coin needs prefix
  const coin = useMemo(
    () => (isPerpsType ? name : `${XYZ_DEX_PREFIX}${name}`),
    [isPerpsType, name],
  );
  const tag = isPerpsType ? `${maxLeverage}X` : 'xyz';

  const handlePress = useCallback(() => {
    setPerpPageEnterSource(EPerpPageEnterSource.UniversalSearch);
    setTimeout(async () => {
      navigation.switchTab(ETabRoutes.Perp);
      try {
        await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
          coin,
        });
      } catch (error) {
        console.error('Failed to change active asset:', error);
      }
      setTimeout(() => {
        universalSearchActions.current.addIntoRecentSearchList({
          id: `perp-${coin}`,
          text: name,
          type: item.type,
          timestamp: Date.now(),
          extra: { coin, assetType },
        });
      }, 10);
    }, 80);
  }, [coin, name, assetType, item.type, navigation, universalSearchActions]);

  return (
    <ListItem
      jc="space-between"
      onPress={handlePress}
      renderAvatar={
        <Token
          size="lg"
          borderRadius="$full"
          tokenImageUri={logoUrl}
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
              {name}
            </SizableText>
            <XStack gap="$1">
              <XStack
                borderRadius="$1"
                bg="$bgStrong"
                justifyContent="center"
                alignItems="center"
                px="$1.5"
              >
                <SizableText
                  fontSize={10}
                  alignSelf="center"
                  color="$textSubdued"
                  lineHeight={16}
                >
                  {tag}
                </SizableText>
              </XStack>
              {subtitle ? (
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
                    {subtitle}
                  </SizableText>
                </XStack>
              ) : null}
            </XStack>
          </XStack>
        }
        secondary={
          <SizableText size="$bodyMd" color="$textSubdued">
            {`${name} - USDC`}
          </SizableText>
        }
      />
      <NumberSizeableText
        formatter="price"
        formatterOptions={{ currency: '$' }}
        size="$bodyLgMedium"
        color="$text"
      >
        {midPx}
      </NumberSizeableText>
    </ListItem>
  );
}
