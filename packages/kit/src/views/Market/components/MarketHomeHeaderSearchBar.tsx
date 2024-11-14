import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SearchBar, Shortcut, View, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import { useShortcutsOnRouteFocused } from '../../../hooks/useShortcutsOnRouteFocused';

const SEARCH_IN_PAGE_KEY = EShortcutEvents.SearchInPage;
export function MarketHomeHeaderSearchBar() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const toUniversalSearchPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
      params: {
        filterType: EUniversalSearchType.MarketToken,
      },
    });
  }, [navigation]);

  useShortcutsOnRouteFocused(SEARCH_IN_PAGE_KEY, toUniversalSearchPage);
  return (
    <XStack $gtMd={{ width: 280 }}>
      <SearchBar
        placeholder={intl.formatMessage({
          id: ETranslations.global_search_tokens,
        })}
        containerProps={{ w: '100%' }}
        $gtMd={{ size: 'small' }}
        key="MarketHomeSearchInput"
        addOns={[
          {
            label: <Shortcut shortcutKey={SEARCH_IN_PAGE_KEY} />,
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
