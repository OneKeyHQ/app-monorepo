import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IStackStyle, IXStackProps } from '@onekeyhq/components';
import {
  SearchBar,
  Shortcut,
  View,
  XStack,
  useIsWebHorizontalLayout,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import useAppNavigation from '../../hooks/useAppNavigation';

// The desktop header centers this pill between two flex-basis:0 spacers, so
// every pixel of pill width costs two pixels of room for the header actions,
// which then paint over it (OK-58363). Only Electron renders the update button
// that creates that pressure (HeaderUpdateButton is platformEnv.isDesktop
// gated), so desktop gives up the 320 floor a breakpoint earlier while web and
// extension keep it from $gtLg up.
const searchBarMinWidth = platformEnv.isDesktop
  ? { $gtXl: { minWidth: 320 } }
  : { $gtLg: { minWidth: 320 } };

export function UniversalSearchInput({
  containerProps,
  size = 'large',
  initialTab,
}: {
  containerProps?: IStackStyle;
  size?: 'large' | 'medium' | 'small';
  initialTab?: 'market' | 'dapp';
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const toUniversalSearchPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
      params: initialTab ? { initialTab } : undefined,
    });
  }, [navigation, initialTab]);

  if (size === 'small') {
    return (
      <HeaderIconButton
        size="small"
        icon="SearchOutline"
        title={intl.formatMessage({
          id: ETranslations.global_search_everything,
        })}
        onPress={toUniversalSearchPage}
        testID="home-header-search-btn"
      />
    );
  }
  return (
    <XStack
      {...(searchBarMinWidth as any)}
      width="100%"
      {...(containerProps as IXStackProps)}
    >
      <SearchBar
        size={size === 'medium' ? 'medium' : 'small'}
        containerProps={{ h: size === 'medium' ? 40 : 32 }}
        py="$2"
        key="searchInput"
        placeholder={intl.formatMessage({
          id: platformEnv.isWebDappMode
            ? ETranslations.global_search
            : ETranslations.global_search_everything,
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
      <View
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        onPress={toUniversalSearchPage}
      />
    </XStack>
  );
}

export function MDUniversalSearchInput() {
  const isHorizontal = useIsWebHorizontalLayout();
  return isHorizontal ? null : (
    <XStack px="$pagePadding" pt="$0.5">
      <UniversalSearchInput
        size="medium"
        containerProps={{
          width: '100%',
          // Clear whichever breakpoint searchBarMinWidth used on this platform.
          $gtLg: undefined,
          $gtXl: undefined,
        }}
      />
    </XStack>
  );
}
