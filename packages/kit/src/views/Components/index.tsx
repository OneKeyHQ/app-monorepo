import { useNavigation } from '@react-navigation/native';
import natsort from 'natsort';
import { FlatList } from 'react-native';

import { ListItem, Stack, Text, useThemeValue } from '@onekeyhq/components';
import { GalleryRoutes } from '@onekeyhq/kit/src/routes/Gallery/routes';

const Index = () => {
  const navigation = useNavigation();
  const componentsRoute = Object.values(GalleryRoutes)
    .filter((item) => item.startsWith('component'))
    .sort((a, b) => natsort({ insensitive: true })(a, b));

  return (
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
  );
};

export default Index;
