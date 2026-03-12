import { useCallback, useState } from 'react';

import {
  Button,
  Select,
  SizableText,
  TextAreaInput,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  ENotificationCommand,
  ENotificationPushMessageMode,
} from '@onekeyhq/shared/types/notification';

const modeOptions = [
  {
    label: 'Mode 1: Page Navigation',
    value: ENotificationPushMessageMode.page,
  },
  {
    label: 'Mode 2: Dialog',
    value: ENotificationPushMessageMode.dialog,
  },
  {
    label: 'Mode 3: Open in Browser',
    value: ENotificationPushMessageMode.openInBrowser,
  },
  {
    label: 'Mode 4: Open in App',
    value: ENotificationPushMessageMode.openInApp,
  },
  {
    label: 'Mode 5: Open in DApp',
    value: ENotificationPushMessageMode.openInDapp,
  },
  {
    label: 'Mode 6: Command',
    value: ENotificationPushMessageMode.command,
  },
];

const payloadExamples: Record<ENotificationPushMessageMode, string> = {
  [ENotificationPushMessageMode.page]: JSON.stringify(
    {
      screen: 'modal',
      params: {
        screen: 'SettingModal',
        params: {
          screen: 'SettingListModal',
        },
      },
    },
    // {
    //   'screen': 'main',
    //   'params': {
    //     'screen': 'Discovery',
    //     'params': {
    //       'screen': 'TabDiscovery',
    //     },
    //   },
    // },
    null,
    2,
  ),
  [ENotificationPushMessageMode.dialog]: JSON.stringify(
    {
      title: 'Test Dialog',
      description: 'This is a test dialog from notification payload.',
      confirmButtonProps: { text: 'Confirm' },
      cancelButtonProps: { text: 'Cancel' },
      onConfirm: {
        actionType: 'openInBrowser',
        payload: 'https://onekey.so',
      },
    },
    null,
    2,
  ),
  [ENotificationPushMessageMode.openInBrowser]: 'https://onekey.so',
  [ENotificationPushMessageMode.openInApp]: 'https://onekey.so/support',
  [ENotificationPushMessageMode.openInDapp]: 'https://app.uniswap.org',
  [ENotificationPushMessageMode.command]: JSON.stringify(
    {
      action: ENotificationCommand.openRewardDistributionHistoryModal,
    },
    null,
    2,
  ),
};

export function NotificationPayloadTest() {
  const [selectedMode, setSelectedMode] =
    useState<ENotificationPushMessageMode>(ENotificationPushMessageMode.page);
  const [payload, setPayload] = useState<string>(
    payloadExamples[ENotificationPushMessageMode.page],
  );

  const handleModeChange = useCallback((mode: ENotificationPushMessageMode) => {
    setSelectedMode(mode);
    setPayload(payloadExamples[mode]);
  }, []);

  const handleTest = useCallback(() => {
    try {
      parseNotificationPayload(selectedMode, payload, () => {
        Toast.error({
          title: 'Fallback triggered',
          message: 'Payload parse failed, fallback handler called',
        });
      });
      Toast.success({
        title: 'parseNotificationPayload called',
        message: `Mode: ${selectedMode}`,
      });
    } catch (error) {
      Toast.error({
        title: 'Error',
        message: String(error),
      });
    }
  }, [selectedMode, payload]);

  const handleLoadExample = useCallback(() => {
    setPayload(payloadExamples[selectedMode]);
  }, [selectedMode]);

  return (
    <YStack gap="$4" p="$2">
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Select Mode</SizableText>
        <Select
          title="Notification Mode"
          items={modeOptions}
          value={selectedMode}
          onChange={handleModeChange}
        />
      </YStack>

      <YStack gap="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMdMedium">Payload</SizableText>
          <Button size="small" variant="tertiary" onPress={handleLoadExample}>
            Load Example
          </Button>
        </XStack>
        <TextAreaInput
          value={payload}
          onChangeText={setPayload}
          placeholder="Enter payload..."
          numberOfLines={10}
          style={{ minHeight: 200 }}
        />
      </YStack>

      <YStack gap="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          Mode 1 (page): JSON payload for navigation
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Mode 2 (dialog): JSON payload for dialog
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Mode 3 (openInBrowser): URL string
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Mode 4 (openInApp): URL string
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Mode 5 (openInDapp): URL string for DApp browser
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Mode 6 (command): JSON with action and optional data
        </SizableText>
      </YStack>

      <Button variant="primary" onPress={handleTest}>
        Test parseNotificationPayload
      </Button>
    </YStack>
  );
}
