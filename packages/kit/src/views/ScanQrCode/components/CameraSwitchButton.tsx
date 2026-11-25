import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  IconButton,
  ScrollView,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { nextCamera, resolveCameraIndex } from './ScanCamera/cameraChoice';

import type { IScanCameraInfo } from './ScanCamera';

/**
 * Switches the scanner camera. Hidden with fewer than two cameras. A press
 * moves to the next camera; with three or more, a long press lists them.
 */
export function CameraSwitchButton({
  cameras,
  cameraId,
  onSelect,
  inlinePicker,
}: {
  cameras: IScanCameraInfo[];
  cameraId: string | undefined;
  onSelect: (id: string) => void;
  inlinePicker?: boolean;
}) {
  const intl = useIntl();
  const [pickerOpen, setPickerOpen] = useState(false);
  const picker = useRef<ReturnType<typeof ActionList.show>>(undefined);
  const current = resolveCameraIndex(cameras, cameraId);
  const canOpenInlinePicker = inlinePicker && cameras.length >= 3;

  if (pickerOpen && !canOpenInlinePicker) setPickerOpen(false);

  useEffect(
    () => () => {
      void Promise.resolve(picker.current?.close()).catch(console.error);
    },
    [],
  );

  const onPress = useCallback(() => {
    const next = nextCamera(cameras, cameraId);
    if (next) onSelect(next.id);
  }, [cameraId, cameras, onSelect]);

  const onLongPress = useCallback(() => {
    if (cameras.length < 3) return;
    if (inlinePicker) {
      setPickerOpen(true);
      return;
    }
    picker.current = ActionList.show({
      title: intl.formatMessage({ id: ETranslations.explore_options }),
      items: cameras.map((camera, index) => ({
        label: camera.label,
        icon:
          index === current ? 'CheckLargeOutline' : 'CameraChangeLensOutline',
        onPress: () => onSelect(camera.id),
      })),
    });
  }, [cameras, current, inlinePicker, intl, onSelect]);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  if (cameras.length < 2) return null;
  if (pickerOpen && canOpenInlinePicker) {
    // DeviceStage is above the global modal host.
    return (
      <YStack fullscreen p="$4" gap="$2" bg="$bg">
        <ScrollView flex={1}>
          <YStack gap="$2">
            {cameras.map((camera, index) => (
              <Button
                key={camera.id}
                testID={`scan-camera-pick-${index}`}
                icon={
                  index === current
                    ? 'CheckLargeOutline'
                    : 'CameraChangeLensOutline'
                }
                onPress={() => {
                  closePicker();
                  onSelect(camera.id);
                }}
              >
                {camera.label}
              </Button>
            ))}
          </YStack>
        </ScrollView>
        <Button testID="scan-camera-picker-close" onPress={closePicker}>
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
      </YStack>
    );
  }
  return (
    <IconButton
      testID="scan-camera-switch"
      accessibilityLabel={intl.formatMessage({
        id: ETranslations.global_switch,
      })}
      hotKey
      position="absolute"
      top="$3"
      right="$3"
      size="small"
      variant="secondary"
      bg="$blackA9"
      iconProps={{ color: '$whiteA12' }}
      icon="CameraChangeLensOutline"
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
}
