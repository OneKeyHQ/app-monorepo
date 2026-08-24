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
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import useAppNavigation from '../../hooks/useAppNavigation';
import { getUniversalSearchSource } from '../../views/UniversalSearch/universalSearchSource';

import { HEADER_SEARCH_MIN_WIDTH, HEADER_WIDE_MEDIA_KEY } from './headerLayout';

// Paired with HeaderUpdateButton's collapse — see headerLayout.ts for why both
// must flip at the same breakpoint (OK-58363).
const searchBarMinWidth = {
  [`$${HEADER_WIDE_MEDIA_KEY}`]: { minWidth: HEADER_SEARCH_MIN_WIDTH },
};

export function UniversalSearchInput({
  containerProps,
  size = 'large',
  initialTab,
  tabRoute,
}: {
  containerProps?: IStackStyle;
  size?: 'large' | 'medium' | 'small';
  initialTab?: 'market' | 'dapp';
  tabRoute: ETabRoutes;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const toUniversalSearchPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
      params: {
        source: getUniversalSearchSource(tabRoute),
        ...(initialTab ? { initialTab } : {}),
      },
    });
  }, [initialTab, navigation, tabRoute]);

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

export function MDUniversalSearchInput({ tabRoute }: { tabRoute: ETabRoutes }) {
  const isHorizontal = useIsWebHorizontalLayout();
  return isHorizontal ? null : (
    <XStack px="$pagePadding" pt="$0.5">
      <UniversalSearchInput
        size="medium"
        tabRoute={tabRoute}
        containerProps={{
          width: '100%',
          // Clear whichever breakpoint HEADER_WIDE_MEDIA_KEY resolved to.
          $gtLg: undefined,
          $gtXl: undefined,
        }}
      />
    </XStack>
  );
}
