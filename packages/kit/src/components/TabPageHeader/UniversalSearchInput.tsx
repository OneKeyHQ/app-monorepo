import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SearchBar, Shortcut, View, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import useAppNavigation from '../../hooks/useAppNavigation';

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

  return (
    <XStack $gtMd={{ maxWidth: 320 }} width="100%">
      <SearchBar
        leftIconName="SearchOutline"
        containerProps={{
          w: '100%',
          borderRadius: '$full',
          bg: '$bgStrong',
          borderColor: '$transparent',
        }}
        size="small"
        key="searchInput"
        addOns={[
          {
            label: <Shortcut shortcutKey={EShortcutEvents.UniversalSearch} />,
          },
        ]}
        placeholder={intl.formatMessage({
          id: ETranslations.global_search,
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
