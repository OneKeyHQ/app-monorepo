import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useMedia } from '@onekeyhq/components';
import {
  useCurrentWalletIdAtom,
  useDeviceConnectIdAtom,
  useDeviceMetaStaticAtom,
  useDeviceTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';

import { FirmwareUpdateReminderAlert } from '../../../FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import { useFirmwareUpdateActions } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareUpdateDetectStatus } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateDetectStatus';
import { getTargetFirmwareTypeLabel } from '../../../FirmwareUpdate/utils';

export function DeviceUpdateAlert({ type }: { type?: 'top' | 'bottom' }) {
  const intl = useIntl();
  const [currentWalletId] = useCurrentWalletIdAtom();
  const isQrWallet = accountUtils.isQrWallet({ walletId: currentWalletId });

  const { gtMd } = useMedia();

  const [deviceConnectId] = useDeviceConnectIdAtom();
  const [deviceType] = useDeviceTypeAtom();
  const [deviceMetaStatic] = useDeviceMetaStaticAtom();
  const deviceDetectStatus = useFirmwareUpdateDetectStatus(deviceConnectId);

  const actions = useFirmwareUpdateActions();
  const openChangeLogModalCallback = useCallback(() => {
    void actions.openChangeLogModal({ connectId: deviceConnectId });
  }, [actions, deviceConnectId]);

  const detectResult = useMemo(() => {
    if (!deviceConnectId) return undefined;
    const detectInfo = deviceDetectStatus;
    const shouldUpdate = detectInfo?.hasUpgrade;
    return { shouldUpdate, detectInfo };
  }, [deviceConnectId, deviceDetectStatus]);

  if (type === 'top' && gtMd) {
    return null;
  }

  if (type === 'bottom' && !gtMd) {
    return null;
  }

  if (isQrWallet) return null;
  if (!detectResult?.shouldUpdate) return null;

  let message = 'New firmware is available';
  if (isProtocolV2ProductType(deviceType)) {
    const safeOSVersion =
      detectResult.detectInfo?.toVersion ?? deviceMetaStatic.firmwareVersion;
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
    <FirmwareUpdateReminderAlert
      containerProps={{
        py: '$3.5',
        borderWidth: '$px',
        borderRadius: type === 'top' ? undefined : '$3',
        borderLeftWidth: type === 'top' ? 0 : '$px',
        borderRightWidth: type === 'top' ? 0 : '$px',
      }}
      message={message}
      onPress={openChangeLogModalCallback}
    />
  );
}
