import { useMemo } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import semver from 'semver';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

const VERSION_PLACEHOLDER = '--';

function isValidVersion(version?: string) {
  if (!version) return false;

  if (version === '0.0.0') return false;

  const cleanVersion = semver.clean(version);
  return Boolean(cleanVersion && semver.valid(cleanVersion));
}

function getDisplayVersion(version?: string) {
  return isValidVersion(version)
    ? version ?? VERSION_PLACEHOLDER
    : VERSION_PLACEHOLDER;
}

type ISpecItemProps = {
  title: string;
  value: string;
};

function SpecItem({ title, value }: ISpecItemProps) {
  return (
    <XStack justifyContent="space-between" alignItems="center" h="$9">
      <SizableText size="$headingSm" color="$text" textAlign="left">
        {title}
      </SizableText>
      <SizableText
        flexShrink={1}
        numberOfLines={1}
        size="$bodyMdMedium"
        color="$textSubdued"
        textAlign="right"
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function DeviceSpecsSection({ data }: { data: IHwQrWalletWithDevice }) {
  const intl = useIntl();
  const { device } = data;
  const defaultDeviceInfo = useMemo(
    () => ({
      model: VERSION_PLACEHOLDER,
      bleName: VERSION_PLACEHOLDER,
      bleVersion: VERSION_PLACEHOLDER,
      bootloaderVersion: VERSION_PLACEHOLDER,
      firmwareVersion: VERSION_PLACEHOLDER,
      serialNumber: VERSION_PLACEHOLDER,
      certifications: null,
    }),
    [],
  );
  const { result: deviceInfo } = usePromiseResult(
    async () => {
      if (!device || !device.featuresInfo) {
        return defaultDeviceInfo;
      }

      const versions = await deviceUtils.getDeviceVersion({
        device,
        features: device.featuresInfo,
      });

      const model = await deviceUtils.buildDeviceLabel({
        features: device.featuresInfo,
        buildModelName: true,
      });

      return {
        model: model ?? VERSION_PLACEHOLDER,
        bleName: device.featuresInfo.ble_name ?? VERSION_PLACEHOLDER,
        bleVersion: getDisplayVersion(versions?.bleVersion),
        bootloaderVersion: getDisplayVersion(versions?.bootloaderVersion),
        firmwareVersion: getDisplayVersion(versions?.firmwareVersion),
        serialNumber:
          deviceUtils.getDeviceSerialNoFromFeatures(device.featuresInfo) ??
          VERSION_PLACEHOLDER,
        certifications: [
          EDeviceType.Pro,
          EDeviceType.Classic1s,
          EDeviceType.ClassicPure,
        ].includes(device.deviceType)
          ? 'EAL 6+'
          : null,
      };
    },
    [device, defaultDeviceInfo],
    {
      initResult: defaultDeviceInfo,
    },
  );

  return (
    <YStack gap="$1">
      <XStack ai="center" h="$9">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_device_info,
          })}
        </SizableText>
      </XStack>
      <YStack py="$3" px="$5" bg="$bgSubdued" borderRadius="$4">
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_model,
          })}
          value={deviceInfo.model}
        />
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_serial_number,
          })}
          value={deviceInfo.serialNumber}
        />
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_firmware,
          })}
          value={deviceInfo.firmwareVersion}
        />
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_bluetooth,
          })}
          value={deviceInfo.bleName}
        />
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_bluetooth_firmware,
          })}
          value={deviceInfo.bleVersion}
        />
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_bootloader,
          })}
          value={deviceInfo.bootloaderVersion}
        />
        {deviceInfo.certifications ? (
          <SpecItem
            title={intl.formatMessage({
              id: ETranslations.global_certifications,
            })}
            value={deviceInfo.certifications}
          />
        ) : null}
      </YStack>
    </YStack>
  );
}

export default DeviceSpecsSection;
