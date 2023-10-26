import { FlatList, Text, View } from 'react-native';

import { Icon, Stack, XStack } from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components/src/Icon/Icons';
import Icons from '@onekeyhq/components/src/Icon/Icons';

import { Layout } from './utils/Layout';

const iconData = Object.keys(Icons) as ICON_NAMES[];
const IconGallery = () => (
  <Layout
    description="图标是一种视觉符号，用于表示对象或概念"
    suggestions={['图标的设计应该简洁、易于理解、易于识别']}
    boundaryConditions={[]}
    elements={[
      {
        title: 'colorful icon',
        element: (
          <XStack space={10}>
            <Icon name="AirpodsSolid" color="$icon" />
            <Icon name="AirpodsSolid" color="$iconHover" />
            <Icon name="AirpodsSolid" color="$iconInverse" />
            <Icon name="AirpodsSolid" color="$iconActive" />
          </XStack>
        ),
      },
      {
        title: 'sized icon',
        element: (
          <XStack space={10}>
            <Icon name="AirpodsSolid" color="$icon" size="$4" />
            <Icon name="AirpodsSolid" color="$iconInverse" size="$8" />
            <Icon name="AirpodsSolid" color="$icon" size="$12" />
            <Icon name="AirpodsSolid" color="$iconInverse" size="$16" />
          </XStack>
        ),
      },
      {
        title: 'icons',
        element: (
          <FlatList
            removeClippedSubviews
            style={{ width: '100%', height: 300 }}
            numColumns={4}
            data={iconData}
            renderItem={({ item }) => (
              <Stack width="25%" height={80} alignItems="center" key={item}>
                <Text>{item}</Text>
                <View style={{ position: 'absolute', bottom: 10 }}>
                  <Icon name={item} />
                </View>
              </Stack>
            )}
          />
        ),
      },
    ]}
  />
);

export default IconGallery;
