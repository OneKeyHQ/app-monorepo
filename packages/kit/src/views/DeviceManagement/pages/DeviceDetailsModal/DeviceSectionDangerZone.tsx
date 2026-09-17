import { useCallback, useMemo, useRef, useState } from 'react';

import { EFirmwareType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import { Dialog, Spinner, Toast, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useDeviceAtom,
  useDeviceDetailsActions,
  useDeviceMetaStaticAtom,
  useDeviceTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
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
  const [device] = useDeviceAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const serialNo = device?.deviceStateInfo?.identity.serialNo || device?.uuid;
  const [isResettingPrimeGift, setIsResettingPrimeGift] = useState(false);
  const resettingPrimeGiftRef = useRef(false);

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
        disabled={isFirmwareTypeChangeComingSoon}
        drillIn={!isFirmwareTypeChangeComingSoon}
        onPress={
          isFirmwareTypeChangeComingSoon ? undefined : onPressFirmwareTypeChange
        }
        testID={DeviceManagementTestIDs.switchFirmwareTypeItem}
      >
        {isFirmwareTypeChangeComingSoon ? (
          <XStack alignItems="center">
            <ListItem.Text
              primary={intl.formatMessage({
                id: ETranslations.wallet_feature_coming_soon,
              })}
              align="right"
              primaryTextProps={{
                size: '$bodyMdMedium',
                color: '$textSubdued',
              }}
            />
          </XStack>
        ) : null}
      </ListItem>
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

  const resetPrimeGift = useCallback(async () => {
    if (!serialNo || resettingPrimeGiftRef.current) return;
    resettingPrimeGiftRef.current = true;
    setIsResettingPrimeGift(true);
    try {
      await backgroundApiProxy.servicePrime.apiResetPrimeGift({ serialNo });
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.prime_gift_reset_success__msg,
        }),
      });
      await backgroundApiProxy.servicePrime
        .apiGetPrimeGiftEligibility({ serialNo })
        .catch(() => {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.prime_gift_reset_refresh_failed__msg,
            }),
          });
        });
    } catch (error) {
      Toast.error({
        title:
          (error instanceof Error ? error.message : '') ||
          intl.formatMessage({
            id: ETranslations.prime_gift_reset_failed__msg,
          }),
      });
    } finally {
      resettingPrimeGiftRef.current = false;
      setIsResettingPrimeGift(false);
    }
  }, [intl, serialNo]);

  const onPressResetPrimeGift = useCallback(() => {
    if (!serialNo || resettingPrimeGiftRef.current) return;
    Dialog.show({
      tone: 'destructive',
      title: intl.formatMessage({ id: ETranslations.prime_gift_reset__title }),
      description: intl.formatMessage(
        { id: ETranslations.prime_gift_reset_confirm__desc },
        { serialNo },
      ),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_reset }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
      onConfirm: resetPrimeGift,
    });
  }, [intl, resetPrimeGift, serialNo]);

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
      {devSettings.enabled ? (
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.prime_gift_reset__title,
          })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          disabled={!serialNo || isResettingPrimeGift}
          drillIn={!isResettingPrimeGift}
          onPress={onPressResetPrimeGift}
          testID={DeviceManagementTestIDs.resetPrimeGiftItem}
        >
          {isResettingPrimeGift ? <Spinner size="small" /> : null}
        </ListItem>
      ) : null}
    </ListItemGroup>
  );
}

export default DeviceSectionDangerZone;
