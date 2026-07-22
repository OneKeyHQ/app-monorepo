import { useCallback, useMemo } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import semver from 'semver';

import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

const VERSION_PLACEHOLDER = '--';

function isValidVersion(version?: string) {
  if (!version) return false;

  if (version === '0.0.0') return false;

  const cleanVersion = semver.clean(version);
  return Boolean(cleanVersion && semver.valid(cleanVersion));
}

function getDisplayVersion(version?: string) {
  return isValidVersion(version)
    ? (version ?? VERSION_PLACEHOLDER)
    : VERSION_PLACEHOLDER;
}

type ISpecItemProps = {
  title: string;
  value: string;
  hasCopy?: boolean;
};

function SpecItem({ title, value, hasCopy }: ISpecItemProps) {
  const { copyText } = useClipboard();
  const handleCopy = useCallback(() => {
    copyText(value);
  }, [value, copyText]);
  return (
    <XStack justifyContent="space-between" alignItems="center" h="$9">
      <SizableText size="$headingSm" color="$text" textAlign="left">
        {title}
      </SizableText>
      {hasCopy ? (
        <XStack
          onPress={handleCopy}
          gap="$2"
          justifyContent="center"
          alignItems="center"
        >
          <SizableText
            flexShrink={1}
            numberOfLines={1}
            size="$bodyMdMedium"
            color="$textSubdued"
            textAlign="right"
          >
            {value}
          </SizableText>
          <Icon
            flexShrink={0}
            name="Copy1Outline"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      ) : (
        <SizableText
          flexShrink={1}
          numberOfLines={1}
          size="$bodyMdMedium"
          color="$textSubdued"
          textAlign="right"
        >
          {value}
        </SizableText>
      )}
    </XStack>
  );
}

function DialogDeviceSpecsContent({ data }: { data: IHwQrWalletWithDevice }) {
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
      if (!device) {
        return defaultDeviceInfo;
      }

      const vendorProfile = getVendorProfile(
        device.vendor ?? EHardwareVendor.onekey,
      );
      const state = vendorProfile.isThirdParty
        ? undefined
        : await backgroundApiProxy.serviceHardware
            .refreshDeviceState({
              connectId: device.connectId,
              params: {
                scope: 'basic',
              },
              silentMode: true,
            })
            .catch(() => device.deviceStateInfo);

      let versions;
      if (vendorProfile.isThirdParty) {
        versions = thirdPartyDeviceUtils.getDeviceVersion({
          device,
          features: device.featuresInfo ?? ({} as never),
        });
      } else if (state) {
        versions = deviceUtils.getDeviceVersionsFromState({ state });
      } else {
        versions = await deviceUtils.getDeviceVersion({
          device,
          features: device.featuresInfo,
        });
      }

      const features = device.featuresInfo as typeof device.featuresInfo & {
        internal_model?: string;
        model?: string;
      };
      const model =
        vendorProfile.isThirdParty && device.featuresInfo
          ? thirdPartyDeviceUtils.getDeviceModelName({
              device,
              features,
              defaultDeviceName: vendorProfile.defaultDeviceName,
            })
          : (state?.identity.model ??
            state?.identity.displayName ??
            (device.featuresInfo
              ? await deviceUtils.buildDeviceLabel({
                  features: device.featuresInfo,
                  buildModelName: true,
                })
              : undefined));

      let firmwareTypeLabel;
      if (vendorProfile.isThirdParty) {
        firmwareTypeLabel = deviceUtils.getFirmwareTypeLabelByFirmwareType({
          firmwareType: thirdPartyDeviceUtils.getFirmwareType({
            features: device?.featuresInfo,
          }),
          displayFormat: 'withSpace',
        });
      } else if (state) {
        firmwareTypeLabel = deviceUtils.getFirmwareTypeLabelByFirmwareType({
          firmwareType: state.identity.firmwareType,
          displayFormat: 'withSpace',
        });
      } else {
        firmwareTypeLabel = await deviceUtils.getFirmwareTypeLabel({
          features: device?.featuresInfo,
          displayFormat: 'withSpace',
        });
      }
      const firmwareVersion = `${firmwareTypeLabel}${getDisplayVersion(
        versions?.firmwareVersion,
      )}`;
      const deviceType = state?.identity.deviceType ?? device.deviceType;

      return {
        model: model ?? VERSION_PLACEHOLDER,
        bleName:
          state?.identity.bleName ??
          deviceUtils.buildDeviceBleName({
            features: device.featuresInfo,
          }) ??
          VERSION_PLACEHOLDER,
        bleVersion: getDisplayVersion(versions?.bleVersion),
        bootloaderVersion: getDisplayVersion(versions?.bootloaderVersion),
        firmwareVersion,
        serialNumber:
          (vendorProfile.isThirdParty && device.featuresInfo
            ? thirdPartyDeviceUtils.getSerialNo(device.featuresInfo)
            : state?.identity.serialNo ||
              deviceUtils.getDeviceSerialNoFromFeatures(device.featuresInfo)) ??
          VERSION_PLACEHOLDER,
        certifications: [
          EDeviceType.Pro,
          EDeviceType.Classic1s,
          EDeviceType.ClassicPure,
        ].includes(deviceType)
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
        hasCopy
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
  );
}

export function useDialogDeviceAbout() {
  const intl = useIntl();

  const show = useCallback(
    (data: IHwQrWalletWithDevice) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.global_about_device,
        }),
        icon: 'InfoCircleOutline',
        showFooter: false,
        renderContent: <DialogDeviceSpecsContent data={data} />,
      });
    },
    [intl],
  );

  return { show };
}
