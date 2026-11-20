import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import semver from 'semver';

import {
  Button,
  Dialog,
  SizableText,
  XStack,
  YStack,
  useClipboard,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatLocaleDate } from '@onekeyhq/shared/src/utils/dateUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { DeviceManagementTestIDs } from '../../../testIDs';

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

// The rows read like the app's other detail lists: the label leads, the value
// sits back in the subdued tone.
function SpecItem({ title, value, hasCopy }: ISpecItemProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const handleCopy = useCallback(() => {
    copyText(value);
  }, [value, copyText]);
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      gap="$3"
      minHeight="$9"
    >
      <SizableText size="$bodyMdMedium" color="$text" flexShrink={0}>
        {title}
      </SizableText>
      {hasCopy ? (
        // The value itself copies; the copied toast confirms it. Its pill
        // shows only on hover, press and keyboard focus, and the negative
        // right margin keeps the text on the column's right edge.
        <XStack
          accessibilityRole="button"
          accessibilityHint={intl.formatMessage({
            id: ETranslations.global_copy,
          })}
          focusable
          flexShrink={1}
          px="$2"
          py="$1"
          mr="$-2"
          borderRadius="$2"
          cursor="default"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineStyle: 'solid',
            outlineWidth: 2,
          }}
          onPress={handleCopy}
        >
          <SizableText
            flexShrink={1}
            numberOfLines={1}
            size="$bodyMd"
            color="$textSubdued"
            textAlign="right"
            userSelect="none"
          >
            {value}
          </SizableText>
        </XStack>
      ) : (
        <SizableText
          flexShrink={1}
          numberOfLines={1}
          size="$bodyMd"
          color="$textSubdued"
          textAlign="right"
        >
          {value}
        </SizableText>
      )}
    </XStack>
  );
}

// One card per kind of fact: what the device is, what it runs, its warranty.
// A translucent tint, not a fill: the dialog is white in light and #1b1b1b in
// dark, where the subdued fill (#191919) all but vanishes.
function SpecGroup({ children }: { children: ReactNode }) {
  return (
    <YStack bg="$neutral2" borderRadius="$3" px="$4" py="$1">
      {children}
    </YStack>
  );
}

// When the device was first verified and how long its warranty runs. Only a
// genuine check reads the certificate the lookup takes, so a device not
// checked since the app began keeping it offers that check instead.
function DeviceWarrantyRows({
  serialNo,
  onVerify,
}: {
  serialNo: string;
  onVerify?: () => void;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const { result: cached } = usePromiseResult(
    () => backgroundApiProxy.serviceHardware.getDeviceWarranty({ serialNo }),
    [serialNo],
    { keepResultIfError: true },
  );
  // The kept result shows while the lookup runs again.
  const { result: refreshed } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceHardware.refreshDeviceWarranty({ serialNo }),
    [serialNo],
    { keepResultIfError: true },
  );
  const warranty = refreshed ?? cached;
  if (!warranty) {
    return null;
  }

  if (!warranty.hasCert) {
    const hint = intl.formatMessage({
      id: ETranslations.device_about_warranty_next_check__desc,
    });
    return (
      <SpecGroup>
        <XStack
          justifyContent="space-between"
          alignItems="center"
          gap="$3"
          minHeight="$9"
        >
          <SizableText size="$bodyMdMedium" color="$text" flexShrink={0}>
            {intl.formatMessage({
              id: ETranslations.device_about_warranty__title,
            })}
          </SizableText>
          {onVerify ? (
            <Button
              variant="link"
              size="small"
              p="$0"
              flexShrink={1}
              hitSlop={12}
              iconAfter="ChevronRightSmallOutline"
              testID={DeviceManagementTestIDs.aboutWarrantyVerifyLink}
              onPress={async () => {
                await dialogInstance.close();
                onVerify();
              }}
            >
              {hint}
            </Button>
          ) : (
            <SizableText
              flexShrink={1}
              numberOfLines={1}
              size="$bodyMd"
              color="$textSubdued"
              textAlign="right"
            >
              {hint}
            </SizableText>
          )}
        </XStack>
      </SpecGroup>
    );
  }

  const info = warranty.info;
  let firstVerified: string | undefined;
  let coverage: string | undefined;
  if (info?.status === 'unknown') {
    // Without a record, support goes by the order.
    coverage = intl.formatMessage({
      id: ETranslations.device_about_warranty_order_date__desc,
    });
  } else if (info?.startAt && info.endAt) {
    firstVerified = formatLocaleDate(new Date(info.startAt));
    const endDate = formatLocaleDate(new Date(info.endAt));
    coverage = intl.formatMessage(
      {
        id:
          info.status === 'expired'
            ? ETranslations.device_about_warranty_expired__desc
            : ETranslations.device_about_warranty_until__desc,
      },
      { date: endDate },
    );
  }
  if (!firstVerified && !coverage) {
    return null;
  }
  return (
    <SpecGroup>
      {firstVerified ? (
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.device_about_first_verified__title,
          })}
          value={firstVerified}
        />
      ) : null}
      {coverage ? (
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.device_about_warranty__title,
          })}
          value={coverage}
        />
      ) : null}
    </SpecGroup>
  );
}

function DialogDeviceSpecsContent({
  data,
  state: resolvedState,
  onVerify,
}: {
  data: IHwQrWalletWithDevice;
  state?: IOneKeyDeviceState;
  onVerify?: () => void;
}) {
  const intl = useIntl();
  const { device, wallet } = data;
  const defaultDeviceInfo = useMemo(
    () => ({
      model: VERSION_PLACEHOLDER,
      bleName: VERSION_PLACEHOLDER,
      bleVersion: VERSION_PLACEHOLDER,
      bootloaderVersion: VERSION_PLACEHOLDER,
      firmwareVersion: VERSION_PLACEHOLDER,
      serialNumber: VERSION_PLACEHOLDER,
      certifications: null,
      warrantySerialNo: undefined as string | undefined,
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
        : (resolvedState ?? device.deviceStateInfo);

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
      let model: string | undefined;
      if (vendorProfile.isThirdParty && device.featuresInfo) {
        model = thirdPartyDeviceUtils.getDeviceModelName({
          device,
          features,
          defaultDeviceName: vendorProfile.presentation.defaultName,
        });
      } else if (state) {
        model = deviceUtils.getDefaultDeviceLabel(state.identity.deviceType);
      } else if (device.featuresInfo) {
        model = await deviceUtils.buildDeviceLabel({
          features: device.featuresInfo,
          buildModelName: true,
        });
      }

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
      const serialNo =
        state?.identity.serialNo ||
        deviceUtils.getDeviceSerialNoFromFeatures(device.featuresInfo);

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
            : serialNo) ?? VERSION_PLACEHOLDER,
        certifications: [
          EDeviceType.Pro,
          EDeviceType.Pro2,
          EDeviceType.Classic1s,
          EDeviceType.ClassicPure,
        ].includes(deviceType)
          ? 'EAL 6+'
          : null,
        // Only devices that take the genuine check have a warranty record.
        warrantySerialNo:
          vendorProfile.firmware.verify &&
          !accountUtils.isQrWallet({ walletId: wallet.id })
            ? serialNo?.trim() || undefined
            : undefined,
      };
    },
    [device, wallet.id, defaultDeviceInfo, resolvedState],
    {
      initResult: defaultDeviceInfo,
    },
  );

  const t = (id: ETranslations) => intl.formatMessage({ id });
  return (
    <YStack gap="$3">
      <SpecGroup>
        <SpecItem
          title={t(ETranslations.global_model)}
          value={deviceInfo.model}
        />
        <SpecItem
          title={t(ETranslations.global_serial_number)}
          value={deviceInfo.serialNumber}
          hasCopy
        />
        <SpecItem
          title={t(ETranslations.global_bluetooth)}
          value={deviceInfo.bleName}
        />
        {deviceInfo.certifications ? (
          <SpecItem
            title={t(ETranslations.global_certifications)}
            value={deviceInfo.certifications}
          />
        ) : null}
      </SpecGroup>
      <SpecGroup>
        <SpecItem
          title={t(ETranslations.global_firmware)}
          value={deviceInfo.firmwareVersion}
        />
        <SpecItem
          title={t(ETranslations.global_bluetooth_firmware)}
          value={deviceInfo.bleVersion}
        />
        <SpecItem
          title={t(ETranslations.global_bootloader)}
          value={deviceInfo.bootloaderVersion}
        />
      </SpecGroup>
      {/* Last, so a group that arrives later doesn't push the specs around. */}
      {deviceInfo.warrantySerialNo ? (
        <DeviceWarrantyRows
          serialNo={deviceInfo.warrantySerialNo}
          onVerify={onVerify}
        />
      ) : null}
    </YStack>
  );
}

export function useDialogDeviceAbout() {
  const intl = useIntl();

  const show = useCallback(
    (
      data: IHwQrWalletWithDevice,
      state?: IOneKeyDeviceState,
      // Starts a genuine check, for a device whose warranty needs one.
      onVerify?: () => void,
    ) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.global_about_device,
        }),
        showFooter: false,
        renderContent: (
          <DialogDeviceSpecsContent
            data={data}
            state={state}
            onVerify={onVerify}
          />
        ),
      });
    },
    [intl],
  );

  return { show };
}
