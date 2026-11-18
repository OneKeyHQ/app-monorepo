import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import {
  useCurrentWalletIdAtom,
  useDeviceConnectIdAtom,
  useDeviceTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useFirmwareUpdateActions } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareUpdateDetectStatus } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateDetectStatus';
import { DeviceManagementTestIDs } from '../../testIDs';

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
      // The banner only shows for a detected update, and it can be tapped
      // without the device at hand; the detection already sized the update.
      knownUpdate: { deviceType, estimatedTransferBytes },
    });
  }, [actions, deviceConnectId, deviceType, estimatedTransferBytes]);

  if (isQrWallet) return null;
  if (!deviceConnectId || !deviceDetectStatus?.hasUpgrade) return null;

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
      {intl.formatMessage({
        id: ETranslations.hardware_status_update_available,
      })}
    </Button>
  );
}
