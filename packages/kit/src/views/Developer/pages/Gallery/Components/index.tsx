import { useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import natsort from 'natsort';

import { Input, ListView, Page, View } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useGalleryPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EGalleryRoutes } from '@onekeyhq/shared/src/routes';

if (platformEnv.isDev && platformEnv.isNative) {
  __CURRENT_FILE_PATH__ = '';
}

const Index = () => {
  const [gallery, setGallery] = useGalleryPersistAtom();
  const { galleryLastRoute } = gallery;
  const [searchQuery, setSearchQuery] = useState('');

  const navigation = useNavigation();
  const filteredComponents = Object.values(EGalleryRoutes)
    .filter((item) => item.startsWith('component'))
    .filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => natsort({ insensitive: true })(a, b));

  if (galleryLastRoute) {
    filteredComponents.unshift(galleryLastRoute);
  }

  return (
    <Page>
      <Page.Body>
        <View
          style={{
            width: '90%',
            maxWidth: 640,
            alignSelf: 'center',
          }}
        >
          <Input
            placeholder="Search components..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ListView
          estimatedItemSize="$11"
          flex={1}
          contentContainerStyle={{
            py: 20,
          }}
          data={filteredComponents}
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
