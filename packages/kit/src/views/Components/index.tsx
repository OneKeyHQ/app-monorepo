import { useNavigation } from '@react-navigation/native';
import natsort from 'natsort';
import { FlatList, TouchableOpacity } from 'react-native';

import { Stack, Text } from '@onekeyhq/components';
import { GalleryRoutes } from '@onekeyhq/kit/src/routes/Gallery';

const Index = () => {
  const navigation = useNavigation();

  const componentsRoute = Object.values(GalleryRoutes)
    .filter((item) => item.startsWith('component'))
    .sort((a, b) => natsort({ insensitive: true })(a, b));

  return (
    <FlatList
      data={componentsRoute}
      style={{ flex: 1, backgroundColor: 'background-hovered' }}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          onPress={() => {
            // @ts-expect-error
            navigation.navigate(item);
          }}
        >
          <Stack
            borderBottomWidth={index === componentsRoute.length - 1 ? 0 : 1}
            borderColor="text-subdued"
            paddingLeft={4}
            paddingRight={5}
            paddingHorizontal={2}
            marginVertical={12}
          >
            <Stack display="flex" flexDirection="row">
              <Text variant="$bodyLgMedium">
                {item.replace('component/', '')}
              </Text>
            </Stack>
          </Stack>
        </TouchableOpacity>
      )}
      keyExtractor={(_, index) => index.toString()}
    />
  );
};

export default Index;
