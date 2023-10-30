import { useRoute } from '@react-navigation/core';

import { ModalContainer, SearchBar } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import type { DiscoverModalParamList, DiscoverModalRoutes } from '../../types';
import type { RouteProp } from '@react-navigation/core';

function SearchModal() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<DiscoverModalParamList, DiscoverModalRoutes.SearchModal>
    >();
  const { onSubmitContent } = route.params;
  console.log('route.params: ===> : ', route.params);
  return (
    <ModalContainer>
      <SearchBar
        height="$12"
        onSubmitEditing={(event) => {
          onSubmitContent?.(event.nativeEvent.text);
          navigation.pop();
        }}
      />
    </ModalContainer>
  );
}

export default SearchModal;
