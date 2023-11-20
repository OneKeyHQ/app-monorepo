import { useRoute } from '@react-navigation/core';

import { Page, SearchBar } from '@onekeyhq/components';
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
