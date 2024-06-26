import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Input, View, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
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
    <XStack w={280}>
      <Input
        containerProps={{ w: '100%' }}
        size="small"
        key="searchInput"
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
