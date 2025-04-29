import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const DividerGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Divider"
    elements={[
      {
        title: '默认状态',
        element: (
          <YStack gap="$8">
            <YStack gap="$4">
              <SizableText>Line 1</SizableText>
              <Divider width="100%" />
              <SizableText>Line 2</SizableText>
            </YStack>

            <XStack gap="$4">
              <SizableText>Left</SizableText>
              <Divider vertical />
              <SizableText>Right</SizableText>
            </XStack>
          </YStack>
        ),
      },
    ]}
  />
);

export default DividerGallery;
