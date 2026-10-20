import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  Spotlight,
  SpotlightView,
} from '@onekeyhq/kit/src/components/Spotlight';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
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
        {intl.formatMessage({ id: ETranslations.global_test })}
      </Button>
      <Button testID="spotlight-exit-toggle-backdrop" onPress={toggleBackdrop}>
        {/* Keep the component API identifier literal in this developer control. */}
        {`closeOnBackdropPress: ${intl.formatMessage({
          id: closeOnBackdropPress
            ? ETranslations.global_enabled
            : ETranslations.global_disabled,
        })}`}
      </Button>
      <SizableText testID="spotlight-exit-count">{closeCount}</SizableText>
      <SpotlightView
        visible={visible}
        onConfirm={close}
        confirmText={intl.formatMessage({ id: ETranslations.global_got_it })}
        closeOnBackdropPress={closeOnBackdropPress}
        matchTriggerSize
        content={
          <SizableText>
            {intl.formatMessage({ id: ETranslations.global_description })}
          </SizableText>
        }
      >
        <SizableText>
          {intl.formatMessage({ id: ETranslations.global_test })}
        </SizableText>
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
