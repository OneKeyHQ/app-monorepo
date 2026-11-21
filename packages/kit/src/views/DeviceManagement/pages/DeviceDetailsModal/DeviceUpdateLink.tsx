import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import { Button, HeightTransition, YStack } from '@onekeyhq/components';
import {
  useCurrentWalletIdAtom,
  useDeviceConnectIdAtom,
  useDeviceTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useFirmwareUpdateActions } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareUpdateDetectStatus } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateDetectStatus';
import { DeviceManagementTestIDs } from '../../testIDs';

// Stable identity: HeightTransition memoizes its style prop.
const fullWidthStyle = { width: '100%' } as const;

// A detected update, as a short link under the device's status line; it
// opens the changelog, which names the version.
export function DeviceUpdateLink() {
  const intl = useIntl();
  const [currentWalletId] = useCurrentWalletIdAtom();
  const isQrWallet = accountUtils.isQrWallet({ walletId: currentWalletId });

  const [deviceConnectId] = useDeviceConnectIdAtom();
  const [deviceType] = useDeviceTypeAtom();
  const deviceDetectStatus = useFirmwareUpdateDetectStatus(deviceConnectId);

  const actions = useFirmwareUpdateActions();
  const estimatedTransferBytes = deviceDetectStatus?.estimatedTransferBytes;
  const openChangeLogModalCallback = useCallback(() => {
    void actions.openChangeLogModal({
      connectId: deviceConnectId,
      // The link only shows for a detected update, and it can be tapped
      // without the device at hand; the detection already sized the update.
      knownUpdate: { deviceType, estimatedTransferBytes },
    });
  }, [actions, deviceConnectId, deviceType, estimatedTransferBytes]);

  const visible =
    !isQrWallet && Boolean(deviceConnectId && deviceDetectStatus?.hasUpgrade);
  // There when the page opens, it simply sits there. Detected while the page
  // is open, it opens up instead of pushing everything below in one jump.
  const visibleOnMountRef = useRef(visible);
  const reducedMotion = useReducedMotion();
  if (!visible) return null;

  const link = (
    // The gap above the link belongs to it, so it grows in with the link.
    <YStack pt="$1.5" alignItems="flex-start">
      <Button
        variant="link"
        size="small"
        p="$0"
        alignSelf="flex-start"
        // The link is one text line tall; give fingers the room a row has.
        hitSlop={12}
        iconAfter="ChevronRightSmallOutline"
        onPress={openChangeLogModalCallback}
        testID={DeviceManagementTestIDs.firmwareUpdateLink}
      >
        {intl.formatMessage({
          id: ETranslations.hardware_status_update_available,
        })}
      </Button>
    </YStack>
  );
  if (visibleOnMountRef.current || reducedMotion) return link;
  return (
    <HeightTransition
      duration={250}
      roundHeightToNearestPixel={platformEnv.isNativeIOS}
      style={fullWidthStyle}
    >
      {link}
    </HeightTransition>
  );
}
