import { useRoute } from '@react-navigation/core';

import { ModalContainer, SearchBar } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import type {
  EDiscoveryModalRoutes,
  IDiscoveryModalParamList,
} from '../../router/Routes';
import type { RouteProp } from '@react-navigation/core';

function SearchModal() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IDiscoveryModalParamList, EDiscoveryModalRoutes.SearchModal>
    >();
  const { onSubmitContent } = route.params;
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
