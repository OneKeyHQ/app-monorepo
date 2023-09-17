import { FlatList, View } from 'react-native';
import { Stack } from 'tamagui';

import { Icon, Typography } from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components/src/v2/Icon/Icons';
import Icons from '@onekeyhq/components/src/v2/Icon/Icons';

import { Layout } from './utils/Layout';

const IconGallery = () => (
  <Layout
    description="图标是一种视觉符号，用于表示对象或概念"
    suggestions={['图标的设计应该简洁、易于理解、易于识别']}
    boundaryConditions={[]}
    elements={[
      {
        title: 'icons',
        element: (
          <FlatList
            style={{ width: '100%' }}
            numColumns={4}
            data={Object.keys(Icons) as ICON_NAMES[]}
            renderItem={({ item }) => (
              <Stack width="25%" height={80} alignItems="center" key={item}>
                <Typography.Caption>{item}</Typography.Caption>
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
  // <ScrollView bg="background-hovered">
  //   <Box flexDirection="row" flexWrap="wrap">
  //     {Object.keys(Icons).map((icon) => (
  // <Stack key={icon} p="4">
  //   <Icon name={icon as ICON_NAMES} />
  //   <Typography.Body1>{icon}</Typography.Body1>
  // </Stack>
  //     ))}
  //   </Box>
  // </ScrollView>
);

export default IconGallery;
