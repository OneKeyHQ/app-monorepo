import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IStackStyle, IXStackProps } from '@onekeyhq/components';
import {
  GlassView,
  IconButton,
  SearchBar,
  Shortcut,
  View,
  XStack,
  isLiquidGlassAvailable,
  useIsWebHorizontalLayout,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import type { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import useAppNavigation from '../../hooks/useAppNavigation';

// Fully-rounded pill matching SearchBar's own borderRadius="$full"; the bar's
// fill is made transparent (below) so this Liquid Glass material shows through.
const glassSearchBarStyle = { flex: 1, borderRadius: 9999 } as const;

export function LegacyUniversalSearchInput({
  containerProps,
  size = 'large',
  initialTab,
  // Restricts the universal search to these result types. When omitted the
  // search covers all categories. The Discovery browser tab passes `[Dapp]` so
  // its search doesn't surface market/perp/wallet results (OK-56756).
  filterTypes,
  glass = false,
}: {
  containerProps?: IStackStyle;
  size?: 'large' | 'medium' | 'small';
  initialTab?: 'market' | 'dapp';
  filterTypes?: EUniversalSearchType[];
  glass?: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const toUniversalSearchPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
      params:
        initialTab || filterTypes ? { initialTab, filterTypes } : undefined,
    });
  }, [navigation, initialTab, filterTypes]);

  // iOS 26 only: host the search bar inside a Liquid Glass capsule. Off iOS 26
  // (and every other platform) isLiquidGlassAvailable() is false, so this stays
  // the unchanged opaque search bar.
  const glassActive = glass && isLiquidGlassAvailable();
  // In the glass capsule, grow to 44 so the search pill lines up with the glass
  // button capsule (icon 24 + button padding 12 + capsule py 8 = 44); otherwise
  // keep the normal bar height.
  const baseSearchBarHeight = size === 'medium' ? 40 : 32;
  const searchBarHeight = glassActive ? 44 : baseSearchBarHeight;

  if (size === 'small') {
    return (
      <IconButton
        variant="tertiary"
        icon="SearchOutline"
        title={intl.formatMessage({
          id: ETranslations.global_search,
        })}
        onPress={toUniversalSearchPage}
        testID="home-header-search-btn"
      />
    );
  }
  const searchBar = (
    <SearchBar
      size={size === 'medium' ? 'medium' : 'small'}
      // The search input is shorter (36 for medium / 28 for small) than
      // this fixed container height, and the left search icon is centered
      // to the container. Without alignItems the input is pinned to the
      // top of the container, so its text/icon look vertically off-center
      // relative to that left icon. Centering reconciles them.
      containerProps={{
        h: searchBarHeight,
        alignItems: 'center',
        // In the glass capsule the fill must be transparent so the Liquid
        // Glass material shows through; otherwise keep the default $bgStrong.
        ...(glassActive && { bg: '$transparent' }),
      }}
      py="$2"
      key="searchInput"
      placeholder={intl.formatMessage({
        id: ETranslations.global_search_everything,
      })}
      addOns={[
        {
          label: (
            <View justifyContent="center">
              <Shortcut shortcutKey={EShortcutEvents.UniversalSearch} />
            </View>
          ),
        },
      ]}
    />
  );

  const tapOverlay = (
    <View
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      onPress={toUniversalSearchPage}
    />
  );

  return (
    <XStack
      $gtLg={{ maxWidth: 320 } as any}
      width="100%"
      {...(containerProps as IXStackProps)}
    >
      {glassActive ? (
        // The tap overlay must live INSIDE the GlassView so the touch lands
        // within the glass bounds — that's what drives the system Liquid Glass
        // press (scale) animation. A sibling overlay on top would swallow the
        // touch and the glass would never deform (unlike the icon buttons,
        // whose Pressable is already a child of their GlassView).
        <GlassView
          isInteractive
          glassEffectStyle="regular"
          style={glassSearchBarStyle}
        >
          {searchBar}
          {tapOverlay}
        </GlassView>
      ) : (
        <>
          {searchBar}
          {tapOverlay}
        </>
      )}
    </XStack>
  );
}

export function MDUniversalSearchInput() {
  const isHorizontal = useIsWebHorizontalLayout();
  return isHorizontal ? null : (
    <XStack px="$pagePadding" pt="$0.5">
      <LegacyUniversalSearchInput
        size="medium"
        containerProps={{
          width: '100%',
          $gtLg: undefined,
        }}
      />
    </XStack>
  );
}
