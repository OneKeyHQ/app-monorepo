import { useRoute } from '@react-navigation/core';

import { Page, SearchBar } from '@onekeyhq/components';
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
    <Page>
      <Page.Header title="SearchBar" />
      <Page.Body>
        <SearchBar
          height="$12"
          onSubmitEditing={(event) => {
            onSubmitContent?.(event.nativeEvent.text);
            navigation.pop();
          }}
        />
      </Page.Body>
      <Page.Footer onCancel={navigation.pop} />
    </Page>
  );
}

export default SearchModal;
