import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IStackStyle, IXStackProps } from '@onekeyhq/components';
import {
  IconButton,
  SearchBar,
  Shortcut,
  View,
  XStack,
  useIsWebHorizontalLayout,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import useAppNavigation from '../../hooks/useAppNavigation';

export function LegacyUniversalSearchInput({
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
  return (
    <XStack
      $gtLg={{ maxWidth: 320 } as any}
      width="100%"
      {...(containerProps as IXStackProps)}
    >
      <SearchBar
        size={size === 'medium' ? 'medium' : 'small'}
        // The search input is shorter (36 for medium / 28 for small) than
        // this fixed container height, and the left search icon is centered
        // to the container. Without alignItems the input is pinned to the
        // top of the container, so its text/icon look vertically off-center
        // relative to that left icon. Centering reconciles them.
        containerProps={{
          h: size === 'medium' ? 40 : 32,
          alignItems: 'center',
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
