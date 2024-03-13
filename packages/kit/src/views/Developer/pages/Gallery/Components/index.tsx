import { useNavigation } from '@react-navigation/native';
import natsort from 'natsort';

import { ListView, Page, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { EGalleryRoutes } from '../../routes';

const Index = () => {
  const navigation = useNavigation();
  const componentsRoute = Object.values(EGalleryRoutes)
    .filter((item) => item.startsWith('component'))
    .sort((a, b) => natsort({ insensitive: true })(a, b));

  return (
    <Page>
      <Page.Body>
        <ListView
          estimatedItemSize="$11"
          flex={1}
          paddingVertical={20}
          data={componentsRoute}
          renderItem={({ item }) => (
            <ListItem
              style={{ width: '90%', maxWidth: 640, alignSelf: 'center' }}
              key={item.replace('component-', '')}
              drillIn
              onPress={() => {
                // @ts-expect-error
                navigation.navigate(item);
              }}
              title={
                item.replace('component-', '').charAt(0).toUpperCase() +
                item.replace('component-', '').substring(1)
              }
            />
          )}
          keyExtractor={(_, index) => index.toString()}
        />
      </Page.Body>
    </Page>
  );
};

export default Index;
