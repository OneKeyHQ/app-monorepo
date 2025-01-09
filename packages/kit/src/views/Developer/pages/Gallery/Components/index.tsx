import { useNavigation } from '@react-navigation/native';
import natsort from 'natsort';

import { ListView, Page } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useGalleryPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EGalleryRoutes } from '@onekeyhq/shared/src/routes';

const Index = () => {
  const [gallery, setGallery] = useGalleryPersistAtom();
  const { galleryLastRoute } = gallery;

  const navigation = useNavigation();
  const componentsRoute = Object.values(EGalleryRoutes)
    .filter((item) => item.startsWith('component'))
    .sort((a, b) => natsort({ insensitive: true })(a, b));

  if (galleryLastRoute) {
    componentsRoute.unshift(galleryLastRoute);
  }

  return (
    <Page>
      <Page.Body>
        <ListView
          estimatedItemSize="$11"
          flex={1}
          contentContainerStyle={{
            py: 20,
          }}
          data={componentsRoute}
          renderItem={({ item }) => (
            <ListItem
              style={{ width: '90%', maxWidth: 640, alignSelf: 'center' }}
              key={item.replace('component-', '')}
              drillIn
              onPress={() => {
                // @ts-expect-error
                navigation.navigate(item);

                setGallery((v) => ({
                  ...v,
                  galleryLastRoute: item,
                }));
              }}
              title={
                (galleryLastRoute === item ? '📌 ' : '') +
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
