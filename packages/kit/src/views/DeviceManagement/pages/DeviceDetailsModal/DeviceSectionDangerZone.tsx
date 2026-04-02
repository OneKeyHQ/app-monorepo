import { useCallback, useMemo } from 'react';

import { EFirmwareType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useDeviceDetailsActions,
  useDeviceMetaStaticAtom,
  useDeviceTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { ListItemGroup } from '../ListItemGroup';

import { useFirmwareChangeDialog } from './dialog/DialogFirmwareChange';

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';

function DeviceSectionDangerZone({
  onPressCheckForUpdates,
}: {
  onPressCheckForUpdates: (
    firmwareType?: EFirmwareType,
    baseReleaseInfo?: AllFirmwareRelease,
  ) => void;
}) {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const [deviceMetaStatic] = useDeviceMetaStaticAtom();

  const [deviceType] = useDeviceTypeAtom();
  const isAllowChangeFirmwareType =
    deviceType && deviceUtils.checkAllowChangeFirmwareType(deviceType);

  const { show: showFirmwareChangeDialog } = useFirmwareChangeDialog({
    onSuccess: (
      targetFirmwareType: EFirmwareType,
      fromFirmwareType: EFirmwareType,
      baseReleaseInfo,
    ) => {
      onPressCheckForUpdates(targetFirmwareType, baseReleaseInfo);
    },
    onUpgradeFirmware: () => {
      onPressCheckForUpdates();
    },
  });

  const onPressFirmwareTypeChange = useCallback(async () => {
    const walletWithDevice = await actions.getWalletWithDevice();
    if (!walletWithDevice) return;
    showFirmwareChangeDialog({
      device: walletWithDevice.device,
      hasAllowChangeFirmwareType: !!isAllowChangeFirmwareType,
      targetFirmwareType:
        deviceMetaStatic.firmwareType === EFirmwareType.BitcoinOnly
          ? EFirmwareType.Universal
          : EFirmwareType.BitcoinOnly,
      fromFirmwareType:
        deviceMetaStatic.firmwareType ?? EFirmwareType.Universal,
    });
  }, [
    actions,
    showFirmwareChangeDialog,
    isAllowChangeFirmwareType,
    deviceMetaStatic.firmwareType,
  ]);

  const firmwareTypeChangeView = useMemo(() => {
    if (!isAllowChangeFirmwareType) {
      return null;
    }
    return (
      <ListItem
        key="firmwareTypeChange"
        title={intl.formatMessage(
          {
            id: ETranslations.device_settings_switch_firmware_type,
          },
          {
            type:
              deviceMetaStatic.firmwareType === EFirmwareType.BitcoinOnly
                ? 'Universal'
                : 'Bitcoin-only',
          },
        )}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressFirmwareTypeChange}
      />
    );
  }, [
    isAllowChangeFirmwareType,
    deviceMetaStatic.firmwareType,
    intl,
    onPressFirmwareTypeChange,
  ]);

  const onPressWipeDevice = useCallback(async () => {
    const walletWithDevice = await actions.getWalletWithDevice();
    if (!walletWithDevice) return;
    await backgroundApiProxy.serviceHardware.wipeDevice({
      walletId: walletWithDevice.wallet.id,
      connectId: walletWithDevice.device?.connectId,
    });
  }, [actions]);

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      groupProps={{
        borderColor: '$borderCriticalSubdued',
      }}
      title={intl.formatMessage({
        id: ETranslations.global_danger_zone,
      })}
    >
      {firmwareTypeChangeView}
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.global_wipe_device,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressWipeDevice}
      />
    </ListItemGroup>
  );
}

export default DeviceSectionDangerZone;
