import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import {
  useCurrentWalletIdAtom,
  useDeviceConnectIdAtom,
  useDeviceTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';

import { useFirmwareUpdateActions } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareUpdateDetectStatus } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateDetectStatus';
import { getTargetFirmwareTypeLabel } from '../../../FirmwareUpdate/utils';
import { DeviceManagementTestIDs } from '../../testIDs';

// A detected update, said in the shipped sentence as a link under the
// device's name; it opens the changelog for that update.
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
      // The banner only shows for a detected update, and it can be tapped
      // without the device at hand; the detection already sized the update.
      knownUpdate: { deviceType, estimatedTransferBytes },
    });
  }, [actions, deviceConnectId, deviceType, estimatedTransferBytes]);

  const detectResult = useMemo(() => {
    if (!deviceConnectId) return undefined;
    const detectInfo = deviceDetectStatus;
    const shouldUpdate = detectInfo?.hasUpgrade;
    return { shouldUpdate, detectInfo };
  }, [deviceConnectId, deviceDetectStatus]);

  if (isQrWallet) return null;
  if (!detectResult?.shouldUpdate) return null;

  let message = 'New firmware is available';
  if (isProtocolV2ProductType(deviceType)) {
    const safeOSVersion = detectResult.detectInfo?.toVersion;
    message =
      safeOSVersion && safeOSVersion !== '0.0.0'
        ? intl.formatMessage(
            { id: ETranslations.update_firmware_version_available },
            { version: `SafeOS ${safeOSVersion}` },
          )
        : intl.formatMessage({ id: ETranslations.update_firmware_available });
  } else if (detectResult?.detectInfo?.toVersion) {
    const firmwareTypeLabel = getTargetFirmwareTypeLabel({
      firmwareType: detectResult.detectInfo.toFirmwareType,
      intl,
    });
    const version = [firmwareTypeLabel, detectResult.detectInfo.toVersion]
      .filter(Boolean)
      .join(' ');
    message = intl.formatMessage(
      { id: ETranslations.update_firmware_version_available },
      {
        version,
      },
    );
  } else if (detectResult?.detectInfo?.toVersionBle) {
    message = intl.formatMessage(
      { id: ETranslations.update_bluetooth_version_available },
      {
        version: detectResult.detectInfo.toVersionBle,
      },
    );
  }

  return (
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
      {message}
    </Button>
  );
}
