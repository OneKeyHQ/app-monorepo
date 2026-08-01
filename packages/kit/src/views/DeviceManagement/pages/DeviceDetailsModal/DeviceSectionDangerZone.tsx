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

import { getTargetFirmwareTypeLabel } from '../../../FirmwareUpdate/utils';
import { DeviceManagementTestIDs } from '../../testIDs';
import { ListItemGroup } from '../ListItemGroup';

import { useFirmwareChangeDialog } from './dialog/DialogFirmwareChange';
import { getFirmwareTypeChangeAvailability } from './utils';

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
  const firmwareTypeChangeAvailability =
    getFirmwareTypeChangeAvailability(deviceType);
  const isAllowChangeFirmwareType =
    firmwareTypeChangeAvailability === 'enabled';
  const isFirmwareTypeChangeComingSoon =
    firmwareTypeChangeAvailability === 'comingSoon';

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
    if (firmwareTypeChangeAvailability === 'hidden') {
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
            type: getTargetFirmwareTypeLabel({
              firmwareType:
                deviceMetaStatic.firmwareType === EFirmwareType.BitcoinOnly
                  ? EFirmwareType.Universal
                  : EFirmwareType.BitcoinOnly,
              intl,
            }),
          },
        )}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        subtitle={
          isFirmwareTypeChangeComingSoon
            ? intl.formatMessage({
                id: ETranslations.wallet_feature_coming_soon,
              })
            : undefined
        }
        disabled={isFirmwareTypeChangeComingSoon}
        drillIn={!isFirmwareTypeChangeComingSoon}
        onPress={
          isFirmwareTypeChangeComingSoon ? undefined : onPressFirmwareTypeChange
        }
        testID={DeviceManagementTestIDs.switchFirmwareTypeItem}
      />
    );
  }, [
    firmwareTypeChangeAvailability,
    deviceMetaStatic.firmwareType,
    intl,
    isFirmwareTypeChangeComingSoon,
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
        testID={DeviceManagementTestIDs.wipeDeviceItem}
      />
    </ListItemGroup>
  );
}

export default DeviceSectionDangerZone;
