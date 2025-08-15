import { SizableText, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const FontGallery = () => {
  return (
    <Layout
      filePath={__CURRENT_FILE_PATH__}
      componentName="Empty"
      elements={[
        {
          title: 'Default',
          element: (
            <YStack gap="$2">
              <SizableText>ABCDEFG 12345678 </SizableText>
              <SizableText fontFamily="$monoRegular">
                ABCDEFG 12345678
              </SizableText>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default FontGallery;
