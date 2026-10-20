import { useCallback, useState } from 'react';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  Spotlight,
  SpotlightView,
} from '@onekeyhq/kit/src/components/Spotlight';
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

function ExitLifecyclePage() {
  const [visible, setVisible] = useState(false);
  const [closeOnBackdropPress, setCloseOnBackdropPress] = useState(true);
  const [closeCount, setCloseCount] = useState(0);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => {
    setVisible(false);
    setCloseCount((count) => count + 1);
  }, []);
  const toggleBackdrop = useCallback(() => {
    setCloseOnBackdropPress((enabled) => !enabled);
  }, []);
  return (
    <YStack gap="$4">
      <Button testID="spotlight-exit-open" onPress={open}>
        Show spotlight
      </Button>
      <Button testID="spotlight-exit-toggle-backdrop" onPress={toggleBackdrop}>
        {`Backdrop close: ${closeOnBackdropPress ? 'on' : 'off'}`}
      </Button>
      <SizableText testID="spotlight-exit-count">{closeCount}</SizableText>
      <SpotlightView
        visible={visible}
        onConfirm={close}
        confirmText="Got it"
        closeOnBackdropPress={closeOnBackdropPress}
        matchTriggerSize
        content={
          <SizableText>Keep this card visible until exit ends.</SizableText>
        }
      >
        <SizableText>Spotlight anchor</SizableText>
      </SpotlightView>
    </YStack>
  );
}

export default function SpotlightGallery() {
  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
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
        {
          title: 'Exit lifecycle',
          element: <ExitLifecyclePage />,
        },
      ]}
    />
  );
}
