import { Button, Page, SearchBar, Stack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';

import { EDiscoveryModalRoutes } from '../../router/Routes';

function Dashboard() {
  const navigation = useAppNavigation();
  return (
    <Page>
      <Page.Body>
        <YStack p="$2" alignItems="center" justifyContent="center">
          <Stack
            $md={{
              width: '100%',
            }}
            onPress={() => {
              console.log('onPress');
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.SearchModal,
              });
            }}
          >
            <SearchBar readonly />
          </Stack>
          <Button
            testID="fake-search-modal"
            onPress={() => {
              console.log('onPress');
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.SearchModal,
              });
            }}
          >
            Search Modal
          </Button>
          <Button
            testID="bookmark-modal"
            onPress={() => {
              console.log('onPress');
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.BookmarkListModal,
              });
            }}
          >
            Bookmark Modal
          </Button>
          <Button
            testID="history-modal"
            onPress={() => {
              console.log('onPress');
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.HistoryListModal,
              });
            }}
          >
            History Modal
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default Dashboard;
