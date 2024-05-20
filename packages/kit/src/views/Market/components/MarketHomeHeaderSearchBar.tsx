import { useCallback } from 'react';

import { SearchBar, View, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EUniversalSearchFilterTypes,
  EUniversalSearchPages,
} from '@onekeyhq/shared/src/routes/universalSearch';

export function MarketHomeHeaderSearchBar() {
  const navigation = useAppNavigation();
  const toUniversalSearchPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.UniversalSearchModal, {
      screen: EUniversalSearchPages.UniversalSearch,
      params: {
        filterType: EUniversalSearchFilterTypes.market,
      },
    });
  }, [navigation]);
  return (
    <XStack $gtMd={{ minWidth: 280 }}>
      <SearchBar
        placeholder="Search symbol, contract address"
        containerProps={{ w: '100%' }}
        $gtMd={{ size: 'small' }}
        key="MarketHomeSearchInput"
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
