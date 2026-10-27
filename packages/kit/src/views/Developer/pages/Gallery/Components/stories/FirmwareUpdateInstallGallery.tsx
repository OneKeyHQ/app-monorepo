import { useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  Button,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { FirmwareUpdateInstallView } from '@onekeyhq/kit/src/views/FirmwareUpdate/componentsV2/FirmwareUpdateInstallView';
import type { IFirmwareUpdateInstallViewProps } from '@onekeyhq/kit/src/views/FirmwareUpdate/componentsV2/FirmwareUpdateInstallView';

import { Layout } from './utils/Layout';

// Static states of the unified install page for visual review without
// hardware. Copy and versions are sample data.

const neoItems: IFirmwareUpdateInstallViewProps['items'] = [
  { key: 'safeos', name: 'SafeOS', fromVersion: '1.0.0', toVersion: '1.0.1' },
];
const proItems: IFirmwareUpdateInstallViewProps['items'] = [
  {
    key: 'bootloader',
    name: 'Bootloader',
    fromVersion: '2.8.3',
    toVersion: '2.8.4',
  },
  {
    key: 'firmware',
    name: 'Firmware',
    fromVersion: '4.12.0',
    toVersion: '4.13.0',
    releaseUrl: 'https://github.com/OneKeyHQ/firmware-pro/releases/tag/v4.13.0',
  },
  { key: 'ble', name: 'Bluetooth', fromVersion: '1.0.20', toVersion: '1.0.21' },
];
const switchItems: IFirmwareUpdateInstallViewProps['items'] = [
  {
    key: 'firmware',
    name: 'Firmware',
    fromVersion: '4.21.0',
    toVersion: '4.21.0',
    fromTypeLabel: 'Universal',
    toTypeLabel: 'Bitcoin-only',
  },
];

const base: IFirmwareUpdateInstallViewProps = {
  mode: 'updating',
  deviceType: EDeviceType.Neo,
  items: neoItems,
  stage: 'installing',
  progress: 72,
  remainingTimeText: 'About 1 min left',
  detailsExpanded: false,
  onToggleDetails: () => {},
};

const SCENES: Array<{
  key: string;
  label: string;
  props: Partial<IFirmwareUpdateInstallViewProps>;
}> = [
  { key: 'single', label: 'Updating · single item', props: {} },
  {
    key: 'multi',
    label: 'Updating · multi item (pill)',
    props: {
      deviceType: EDeviceType.Pro,
      items: proItems,
      progress: 46,
      remainingTimeText: 'About 2 min left',
    },
  },
  {
    key: 'details',
    label: 'Details expanded',
    props: {
      deviceType: EDeviceType.Pro,
      items: proItems,
      progress: 46,
      remainingTimeText: 'About 2 min left',
      detailsExpanded: true,
    },
  },
  {
    key: 'preparing',
    label: 'Preparing (no estimate)',
    props: { stage: 'preparing', progress: 1, remainingTimeText: undefined },
  },
  {
    key: 'waiting',
    label: 'Waiting for device',
    props: {
      stage: 'waitingForDevice',
      progress: 12,
      remainingTimeText: undefined,
    },
  },
  {
    key: 'switch',
    label: 'Universal → Bitcoin-only',
    props: {
      deviceType: EDeviceType.Pro,
      items: switchItems,
      progress: 30,
      remainingTimeText: undefined,
      stage: 'enteringUpdateMode',
    },
  },
  {
    key: 'error',
    label: 'Error · disconnected',
    props: {
      mode: 'error',
      progress: 38,
      remainingTimeText: undefined,
      errorSentence:
        'The device has been disconnected. Please reconnect the device and try again.',
    },
  },
  {
    key: 'errorTutorial',
    label: 'Error · manual bootloader (Classic)',
    props: {
      mode: 'error',
      deviceType: EDeviceType.Classic1s,
      items: [
        {
          key: 'firmware',
          name: 'Firmware',
          fromVersion: '3.9.0',
          toVersion: '3.10.0',
        },
      ],
      stage: 'enteringUpdateMode',
      progress: 10,
      remainingTimeText: undefined,
      errorSentence: 'Manually entering bootloader mode',
      tutorialUrl: 'https://help.onekey.so',
    },
  },
  {
    key: 'workflowError',
    label: 'Workflow error · battery',
    props: {
      mode: 'workflowError',
      workflowError: {
        title: 'Insufficient battery power',
        message: 'Charge your device to at least 25% and try again.',
      },
    },
  },
  {
    key: 'done',
    label: 'Done',
    props: {
      mode: 'done',
      progress: 100,
      doneVersionText: 'SafeOS 1.0.1',
      doneReleaseUrl: 'https://github.com/OneKeyHQ/firmware-pro/releases',
      doneAction: { text: 'Done', onPress: () => {} },
    },
  },
  {
    key: 'doneSwitch',
    label: 'Done · Bitcoin-only',
    props: {
      mode: 'done',
      deviceType: EDeviceType.Pro,
      items: switchItems,
      progress: 100,
      doneVersionText: 'Bitcoin-only 4.21.0',
      doneAction: { text: 'Import wallet', onPress: () => {} },
    },
  },
];

const FirmwareUpdateInstallGallery = () => {
  const [sceneKey, setSceneKey] = useState(SCENES[0].key);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const scene = SCENES.find((item) => item.key === sceneKey) ?? SCENES[0];
  const props: IFirmwareUpdateInstallViewProps = {
    ...base,
    ...scene.props,
    detailsExpanded: scene.props.detailsExpanded ?? detailsExpanded,
    onToggleDetails: setDetailsExpanded,
  };

  return (
    <Layout
      componentName="FirmwareUpdateInstall"
      description="Unified install page states (sample data). The page footer is rendered by the route, not here."
      elements={[
        {
          title: 'Scene',
          element: (
            <XStack flexWrap="wrap" gap="$2">
              {SCENES.map((item) => (
                <Button
                  key={item.key}
                  size="small"
                  variant={item.key === sceneKey ? 'primary' : 'secondary'}
                  onPress={() => {
                    setSceneKey(item.key);
                    setDetailsExpanded(false);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </XStack>
          ),
        },
        {
          title: 'Preview (640 wide)',
          element: (
            <YStack gap="$2">
              <Stack
                w={640}
                maxWidth="100%"
                minHeight={560}
                borderWidth={1}
                borderColor="$borderSubdued"
                borderRadius="$4"
                bg="$bgApp"
                px="$5"
              >
                <FirmwareUpdateInstallView {...props} />
              </Stack>
              <SizableText size="$bodySm" color="$textSubdued">
                mode={props.mode} · stage={props.stage} · progress=
                {props.progress}
              </SizableText>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default FirmwareUpdateInstallGallery;
