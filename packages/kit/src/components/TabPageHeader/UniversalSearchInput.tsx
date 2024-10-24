import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Input,
  Shortcut,
  View,
  XStack,
  useShortcuts,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useRouteIsFocused } from '../../hooks/useRouteIsFocused';

const SEARCH_IN_PAGE_KEY = EShortcutEvents.SearchInPage;
export function UniversalSearchInput() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const toUniversalSearchPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
      params: {
        filterType: EUniversalSearchType.Address,
      },
    });
  }, [navigation]);

  const isFocus = useRouteIsFocused();

  const onShortCuts = useCallback(() => {
    if (isFocus) {
      toUniversalSearchPage();
    }
  }, [isFocus, toUniversalSearchPage]);
  useShortcuts(SEARCH_IN_PAGE_KEY, onShortCuts);

  return (
    <XStack w={280}>
      <Input
        leftIconName="SearchOutline"
        containerProps={{ w: '100%' }}
        size="small"
        key="searchInput"
        addOns={[
          {
            label: <Shortcut shortcutKey={SEARCH_IN_PAGE_KEY} />,
          },
        ]}
        placeholder={intl.formatMessage({
          id: ETranslations.global_search_address,
        })}
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
