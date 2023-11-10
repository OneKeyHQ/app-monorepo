import { useNavigation } from '@react-navigation/native';
import natsort from 'natsort';
import { FlatList } from 'react-native';

import { ListItem, Screen } from '@onekeyhq/components';
import { EGalleryRoutes } from '@onekeyhq/kit/src/routes/Root/Tab/Developer/Gallery/routes';

const Index = () => {
  const navigation = useNavigation();
  const componentsRoute = Object.values(EGalleryRoutes)
    .filter((item) => item.startsWith('component'))
    .sort((a, b) => natsort({ insensitive: true })(a, b));

  return (
    <Screen>
      <FlatList
        data={componentsRoute}
        style={{
          flex: 1,
          paddingVertical: 20,
        }}
        contentContainerStyle={{
          marginHorizontal: 'auto',
          width: 640,
          maxWidth: '100%',
        }}
        renderItem={({ item }) => (
          <ListItem
            key={item.replace('component/', '')}
            drillIn
            onPress={() => {
              // @ts-expect-error
              navigation.navigate(item);
            }}
            title={
              item.replace('component/', '').charAt(0).toUpperCase() +
              item.replace('component/', '').substring(1)
            }
          />
        )}
        keyExtractor={(_, index) => index.toString()}
      />
    </Screen>
  );
};

export default Index;
