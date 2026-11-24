import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, IconButton } from '@onekeyhq/components';
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
}: {
  cameras: IScanCameraInfo[];
  cameraId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const intl = useIntl();
  const onPress = useCallback(() => {
    const next = nextCamera(cameras, cameraId);
    if (next) onSelect(next.id);
  }, [cameraId, cameras, onSelect]);

  const onLongPress = useCallback(() => {
    if (cameras.length < 3) return;
    const current = resolveCameraIndex(cameras, cameraId);
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.explore_options }),
      items: cameras.map((camera, index) => ({
        label: camera.label,
        icon:
          index === current ? 'CheckLargeOutline' : 'CameraChangeLensOutline',
        onPress: () => onSelect(camera.id),
      })),
    });
  }, [cameraId, cameras, intl, onSelect]);

  if (cameras.length < 2) return null;
  return (
    <IconButton
      testID="scan-camera-switch"
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
