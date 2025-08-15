import { useState } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  Input,
  ListView,
  SizableText,
  Stack,
  Toast,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import Icons from '@onekeyhq/components/src/primitives/Icon/Icons';

import { Layout } from './utils/Layout';

const iconData = Object.keys(Icons) as IKeyOfIcons[];
const IconGallery = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { copyText } = useClipboard();

  const filteredIcons = iconData.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Layout
      filePath={__CURRENT_FILE_PATH__}
      componentName="Icon"
      description="图标是一种视觉符号，用于表示对象或概念"
      suggestions={['图标的设计应该简洁、易于理解、易于识别']}
      boundaryConditions={[]}
      elements={[
        {
          title: 'colorful icon',
          element: (
            <XStack gap={10}>
              <Icon name="AirpodsSolid" color="$icon" />
              <Icon name="AirpodsSolid" color="$iconHover" />
              <Icon name="AirpodsSolid" color="$iconInverse" />
              <Icon name="AirpodsSolid" color="$iconActive" />
              <Icon name="AirpodsSolid" color="$iconSuccess" />
            </XStack>
          ),
        },
        {
          title: 'sized icon',
          element: (
            <XStack gap={10}>
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
            <Stack gap="$4" width="100%">
              <Input
                placeholder="Search icons..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <ListView
                estimatedItemSize="$20"
                removeClippedSubviews
                width="100%"
                height="$75"
                numColumns={2}
                data={filteredIcons}
                renderItem={({ item }) => (
                  <XStack
                    alignItems="center"
                    gap="$2"
                    pl="$1"
                    width="50%"
                    height="$8"
                    key={item}
                    hoverStyle={{
                      cursor: 'pointer',
                      backgroundColor: '$bgStrong',
                      borderRadius: '$2',
                    }}
                    onPress={() => {
                      copyText(item);
                      Toast.success({
                        title: `Copied ${item}`,
                      });
                    }}
                  >
                    <Icon name={item} />
                    <SizableText size="$bodySm">{item}</SizableText>
                  </XStack>
                )}
              />
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default IconGallery;
