import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useMedia } from '@onekeyhq/components';
import {
  useCurrentWalletIdAtom,
  useDeviceConnectIdAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { useFirmwareUpdatesDetectStatusPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { FirmwareUpdateReminderAlert } from '../../../FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import { useFirmwareUpdateActions } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateActions';

export function DeviceUpdateAlert({ type }: { type?: 'top' | 'bottom' }) {
  const intl = useIntl();
  const [currentWalletId] = useCurrentWalletIdAtom();
  const isQrWallet = accountUtils.isQrWallet({ walletId: currentWalletId });

  const { gtMd } = useMedia();

  const [detectStatus] = useFirmwareUpdatesDetectStatusPersistAtom();
  const [deviceConnectId] = useDeviceConnectIdAtom();

  const actions = useFirmwareUpdateActions();
  const openChangeLogModalCallback = useCallback(() => {
    actions.openChangeLogModal({ connectId: deviceConnectId });
  }, [actions, deviceConnectId]);

  const detectResult = useMemo(() => {
    if (!deviceConnectId) return undefined;
    const detectInfo = detectStatus?.[deviceConnectId];
    const shouldUpdate =
      detectInfo?.connectId === deviceConnectId && detectInfo?.hasUpgrade;
    return { shouldUpdate, detectInfo };
  }, [deviceConnectId, detectStatus]);

  if (type === 'top' && gtMd) {
    return null;
  }

  if (type === 'bottom' && !gtMd) {
    return null;
  }

  if (isQrWallet) return null;
  if (!detectResult?.shouldUpdate) return null;

  let message = 'New firmware is available';
  if (detectResult?.detectInfo?.toVersion) {
    const firmwareTypeLabel = deviceUtils.getFirmwareTypeLabelByFirmwareType({
      firmwareType: detectResult.detectInfo.toFirmwareType,
      displayFormat: 'withSpace',
    });
    const version = `${firmwareTypeLabel}${detectResult.detectInfo.toVersion}`;
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
