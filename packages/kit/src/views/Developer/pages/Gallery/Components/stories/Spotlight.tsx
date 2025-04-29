import { Button, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Spotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { Layout } from './utils/Layout';

function DefaultPage() {
  return (
    <YStack gap="$4">
      <Spotlight
        delayMs={300}
        containerProps={{ flexShrink: 1 }}
        isVisible
        message="description content"
        tourName={ESpotlightTour.createAllNetworks}
      >
        <SizableText>content</SizableText>
      </Spotlight>

      <Button
        onPress={() => {
          void backgroundApiProxy.serviceSpotlight.reset();
        }}
      >
        <SizableText>show spotlight</SizableText>
      </Button>
    </YStack>
  );
}

export default function SpotlightGallery() {
  return (
    <Layout
      filePath={__CURRENT_FILE_PATH__}
      componentName="Spotlight"
      description="Spotlight 组件"
      suggestions={[
        '如果需要重复测试需用 backgroundApiProxy.serviceSpotlight.reset(); 重置',
        '需要定义唯一 ESpotlightTour 值',
      ]}
      elements={[
        {
          title: 'Default',
          element: <DefaultPage />,
        },
      ]}
    />
  );
}
