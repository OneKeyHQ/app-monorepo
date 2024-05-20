import { useCallback } from 'react';

import { Input, View, XStack } from '@onekeyhq/components';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EUniversalSearchFilterTypes,
  EUniversalSearchPages,
} from '@onekeyhq/shared/src/routes/universalSearch';

import useAppNavigation from '../../hooks/useAppNavigation';

export function UniversalSearchInput() {
  const navigation = useAppNavigation();
  const toUniversalSearchPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
      params: {
        filterType: EUniversalSearchFilterTypes.account,
      },
    });
  }, [navigation]);
  return (
    <XStack w={280}>
      <Input
        containerProps={{ w: '100%' }}
        size="small"
        key="searchInput"
        placeholder="Search address"
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
