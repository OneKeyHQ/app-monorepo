import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  ButtonFrame,
  Icon,
  IconButton,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { nextCamera, resolveCameraIndex } from './ScanCamera/cameraChoice';

import type { IScanCameraInfo } from './ScanCamera';

/**
 * Mobile (`platformEnv.isNative`): top-right icon button that cycles cameras on
 * tap (hidden with fewer than two cameras) and lists them on long-press when
 * three or more exist.
 *
 * Desktop / Web / Extension (`!platformEnv.isNative`): translucent top pill
 * displaying the active camera label; with two or more cameras, clicking opens
 * a dropdown list to pick any camera.
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
  const isNative = Boolean(platformEnv.isNative);
  const [pickerOpen, setPickerOpen] = useState(false);
  const picker = useRef<ReturnType<typeof ActionList.show>>(undefined);
  const current = resolveCameraIndex(cameras, cameraId);
  const currentCamera = cameras[current];
  const canOpenNativePicker = isNative && cameras.length >= 3;
  const canOpenNativeInlinePicker = Boolean(
    inlinePicker && canOpenNativePicker,
  );
  const canOpenDesktopDropdown = !isNative && cameras.length >= 2;
  const canKeepPickerOpen = isNative
    ? canOpenNativeInlinePicker
    : canOpenDesktopDropdown;

  if (pickerOpen && !canKeepPickerOpen) setPickerOpen(false);

  useEffect(
    () => () => {
      void Promise.resolve(picker.current?.close()).catch(console.error);
    },
    [],
  );

  const openNativePicker = useCallback(() => {
    if (!canOpenNativePicker) return;
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
  }, [cameras, canOpenNativePicker, current, inlinePicker, intl, onSelect]);

  const onNativePress = useCallback(() => {
    const next = nextCamera(cameras, cameraId);
    if (next) onSelect(next.id);
  }, [cameraId, cameras, onSelect]);

  const toggleDesktopDropdown = useCallback(() => {
    if (!canOpenDesktopDropdown) return;
    setPickerOpen((prev) => !prev);
  }, [canOpenDesktopDropdown]);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  if (pickerOpen && canOpenNativeInlinePicker) {
    // DeviceStage is above the global modal host on native.
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

  if (isNative) {
    if (cameras.length < 2) return null;
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
        onPress={onNativePress}
        onLongPress={openNativePicker}
      />
    );
  }

  if (!currentCamera) return null;

  const capsuleStyle = {
    pointerEvents: 'auto',
    alignItems: 'center',
    gap: '$1.5',
    bg: '$blackA9',
    borderRadius: '$full',
    px: '$3',
    py: '$1.5',
    maxWidth: '100%',
    userSelect: 'none',
  } as const;
  const capsuleLabel = (
    <>
      <Icon name="CameraChangeLensOutline" size="$4" color="$whiteA12" />
      <SizableText
        testID="scan-camera-current-label"
        size="$bodySmMedium"
        color="$whiteA12"
        numberOfLines={1}
        flexShrink={1}
      >
        {currentCamera.label}
      </SizableText>
    </>
  );

  return (
    <>
      {pickerOpen && canOpenDesktopDropdown ? (
        <YStack
          fullscreen
          testID="scan-camera-dropdown-backdrop"
          onPress={closePicker}
        />
      ) : null}
      <YStack
        position="absolute"
        top="$3"
        left="$9"
        right="$9"
        alignItems="center"
        pointerEvents="box-none"
      >
        {canOpenDesktopDropdown ? (
          <ButtonFrame
            {...capsuleStyle}
            testID="scan-camera-switch"
            aria-expanded={pickerOpen}
            aria-label={intl.formatMessage({ id: ETranslations.global_switch })}
            cursor="pointer"
            hoverStyle={{ bg: '$blackA10' }}
            pressStyle={{ opacity: 0.85 }}
            onPress={toggleDesktopDropdown}
          >
            {capsuleLabel}
            <Icon name="ChevronDownSmallOutline" size="$4" color="$whiteA12" />
          </ButtonFrame>
        ) : (
          <XStack {...capsuleStyle} testID="scan-camera-info">
            {capsuleLabel}
          </XStack>
        )}
        {pickerOpen && canOpenDesktopDropdown ? (
          <YStack
            testID="scan-camera-dropdown"
            pointerEvents="auto"
            mt="$1.5"
            width="100%"
            maxWidth={240}
            maxHeight={168}
            bg="$blackA11"
            borderRadius="$3"
            p="$1"
            overflow="hidden"
          >
            <ScrollView>
              <YStack gap="$0.5">
                {cameras.map((camera, index) => {
                  const selected = index === current;
                  return (
                    <ButtonFrame
                      key={camera.id}
                      testID={`scan-camera-pick-${index}`}
                      aria-pressed={selected}
                      alignItems="center"
                      justifyContent="space-between"
                      gap="$2"
                      px="$2.5"
                      py="$2"
                      borderRadius="$2"
                      cursor="pointer"
                      userSelect="none"
                      bg={selected ? '$whiteA3' : 'transparent'}
                      hoverStyle={{ bg: '$whiteA4' }}
                      pressStyle={{ opacity: 0.85 }}
                      onPress={() => {
                        closePicker();
                        onSelect(camera.id);
                      }}
                    >
                      <SizableText
                        size="$bodySmMedium"
                        color="$whiteA12"
                        numberOfLines={1}
                        flex={1}
                      >
                        {camera.label}
                      </SizableText>
                      {selected ? (
                        <Icon
                          name="CheckLargeOutline"
                          size="$4"
                          color="$whiteA12"
                        />
                      ) : null}
                    </ButtonFrame>
                  );
                })}
              </YStack>
            </ScrollView>
          </YStack>
        ) : null}
      </YStack>
    </>
  );
}
