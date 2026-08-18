import { useCallback, useMemo } from 'react';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import {
  LeverageBadge,
  PerpDexBadge,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { buildCoinFromSearchAssetType } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import { getHyperliquidTokenImageUris } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  EUniversalSearchSource,
  IUniversalSearchPerp,
} from '@onekeyhq/shared/types/search';

import { MarketPerpsStarV2 } from '../../../Market/components/MarketStarV2';

const shouldShowFavoriteButton =
  !platformEnv.isExtensionUiPopup && !platformEnv.isExtensionUiSidePanel;

interface IUniversalSearchPerpItemProps {
  item: IUniversalSearchPerp;
  getSearchInput: () => string;
  source: EUniversalSearchSource;
}

export function UniversalSearchPerpItem({
  item,
  getSearchInput,
  source,
}: IUniversalSearchPerpItemProps) {
  const [{ isMounted }] = useMarketWatchListV2Atom();
  const navigation = useAppNavigation();
  const universalSearchActions = useUniversalSearchActions();
  const { assetType, logoUrl, name, maxLeverage, midPx, subtitle } =
    item.payload;

  const isPerpsType = assetType === 'perps';
  // `assetType` is the dex prefix itself, so assuming xyz for every non-main
  // result would send `xyz:UNITREE` for a para asset.
  const coin = useMemo(
    () => buildCoinFromSearchAssetType({ assetType, name }) ?? '',
    [assetType, name],
  );
  const dexLabel = isPerpsType ? undefined : assetType;
  // The search index sends a bare-symbol logo, which 404s for `para:UNITREE`
  // and renders Stacks for `para:STX`. The dex-prefixed asset is the right one.
  const tokenImageUris = useMemo(
    () => (isPerpsType ? undefined : getHyperliquidTokenImageUris(coin)),
    [coin, isPerpsType],
  );

  const handlePress = useCallback(() => {
    defaultLogger.universalSearch.search.universalSearchClick({
      source,
      searchText: getSearchInput(),
      type: item.type,
      itemId: coin,
      itemTitle: name,
    });

    setPerpPageEnterSource(EPerpPageEnterSource.UniversalSearch);
    setTimeout(async () => {
      try {
        // A missing intent only costs the first-mount restore, so this
        // must not be able to abort the tap. Recorded before the navigation
        // that mounts the Perp tab, so the claiming initial-select cannot
        // run ahead of it.
        await backgroundApiProxy.serviceHyperliquid.setPendingInstrumentIntent({
          coin,
          mode: 'perp',
        });
      } catch {
        // ignore
      }
      navigation.switchTab(ETabRoutes.Perp);
      try {
        await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
          coin,
        });
        appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
          mode: 'perp',
          coin,
        });
      } catch (error) {
        console.error('Failed to change active asset:', error);
        return;
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
  }, [
    coin,
    getSearchInput,
    item.type,
    name,
    assetType,
    navigation,
    source,
    universalSearchActions,
  ]);

  // An unknown dex cannot be opened or favorited; rendering the row would give a
  // silent no-op on tap and let the star persist an empty `perpsCoin`.
  if (!coin) {
    return null;
  }

  return (
    <ListItem
      jc="space-between"
      onPress={handlePress}
      renderAvatar={
        <XStack alignItems="center" gap="$2">
          {shouldShowFavoriteButton && isMounted ? (
            <MarketPerpsStarV2 perpsCoin={coin} size="small" />
          ) : null}
          <Token
            size="lg"
            borderRadius="$full"
            {...(tokenImageUris
              ? { tokenImageUris }
              : { tokenImageUri: logoUrl })}
            fallbackIcon="CryptoCoinOutline"
          />
        </XStack>
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
              {maxLeverage > 0 ? (
                <LeverageBadge leverage={maxLeverage} />
              ) : null}
              <PerpDexBadge dexLabel={dexLabel} />
            </XStack>
          </XStack>
        }
        secondary={
          subtitle ? (
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {subtitle}
            </SizableText>
          ) : undefined
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
