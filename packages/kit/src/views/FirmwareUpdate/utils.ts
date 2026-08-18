import { EFirmwareType } from '@onekeyfe/hd-shared';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import type {
  ICheckAllFirmwareReleaseResult,
  IPro2FirmwareUpdateTarget,
} from '@onekeyhq/shared/types/device';

import type { IntlShape } from 'react-intl';

export async function getFirmwareUpdateUSBPreflightParams(
  result: ICheckAllFirmwareReleaseResult | undefined,
) {
  const usbConnectId = await deviceUtils.buildDeviceUSBConnectId({
    features: result?.features,
  });

  return {
    connectId:
      usbConnectId ?? result?.updatingConnectId ?? result?.originalConnectId,
    connectProtocol: isProtocolV2ProductType(result?.deviceType)
      ? ('V2' as const)
      : undefined,
  };
}

export function getFirmwareUpdateDeviceTitle(
  result: ICheckAllFirmwareReleaseResult,
) {
  if (result.deviceName) {
    return result.deviceName;
  }

  return result.deviceType
    ? deviceUtils.getDefaultDeviceLabel(result.deviceType)
    : undefined;
}

export function isPro2SafeOSFirmwareUpdate(
  result: ICheckAllFirmwareReleaseResult | undefined,
) {
  if (!result || !isProtocolV2ProductType(result.deviceType)) {
    return false;
  }
  return (
    result.updateInfos?.firmware?.hasUpgrade === true ||
    result.pro2TargetsToUpdate?.some(
      (target) => target === 'app_v1' || target === 'app_v2',
    ) === true
  );
}

export function hasProtocolV2FirmwareUpdateTarget(
  result: ICheckAllFirmwareReleaseResult | undefined,
  target: IPro2FirmwareUpdateTarget,
) {
  return result?.pro2TargetsToUpdate?.includes(target) === true;
}

export function getProtocolV2ResourceReleaseId(
  result: ICheckAllFirmwareReleaseResult | undefined,
) {
  if (!hasProtocolV2FirmwareUpdateTarget(result, 'resource')) {
    return undefined;
  }
  const archiveSha256 = result?.pro2ResourceArchive?.archiveSha256;
  if (!archiveSha256) {
    return undefined;
  }
  return `SHA-256 ${archiveSha256.slice(0, 12)}`;
}

export type IProtocolV2FirmwareVersionDisplayItem = {
  target: 'safeos' | IPro2FirmwareUpdateTarget;
  currentVersion: string | null;
  targetVersion: string | null;
  releaseIdentifierOnly?: boolean;
};

export function getProtocolV2FirmwareVersionTitle({
  target,
  intl,
}: {
  target: IProtocolV2FirmwareVersionDisplayItem['target'];
  intl: IntlShape;
}) {
  if (target === 'safeos') return 'SafeOS';
  if (target === 'boot') {
    return intl.formatMessage({ id: ETranslations.global_bootloader });
  }
  if (target === 'coprocessor') {
    return intl.formatMessage({ id: ETranslations.global_bluetooth });
  }
  if (target === 'resource') {
    return intl.formatMessage({ id: ETranslations.global_resources });
  }
  if (target === 'app_v1') return 'App P1';
  if (target === 'app_v2') return 'App P2';
  return target.toUpperCase();
}

export function getProtocolV2FirmwareVersionDisplayItems(
  result: ICheckAllFirmwareReleaseResult | undefined,
  { includeComponents = false }: { includeComponents?: boolean } = {},
): IProtocolV2FirmwareVersionDisplayItem[] {
  if (!result || !isProtocolV2ProductType(result.deviceType)) {
    return [];
  }

  const versionInfo = result.protocolV2FirmwareVersionInfo;
  const items: IProtocolV2FirmwareVersionDisplayItem[] = [
    {
      target: 'safeos',
      currentVersion: versionInfo?.safeOS.currentVersion ?? null,
      targetVersion: versionInfo?.safeOS.targetVersion ?? null,
    },
  ];

  if (!includeComponents) {
    return items;
  }

  for (const target of result.pro2TargetsToUpdate ?? []) {
    if (target === 'resource') {
      items.push({
        target,
        currentVersion: null,
        targetVersion: getProtocolV2ResourceReleaseId(result) ?? null,
        releaseIdentifierOnly: true,
      });
    } else {
      const component = versionInfo?.components.find(
        (item) => item.target === target,
      );
      items.push({
        target,
        currentVersion: component?.currentVersion ?? null,
        targetVersion: component?.targetVersion ?? null,
      });
    }
  }

  return items;
}

export function getTargetFirmwareTypeLabel({
  firmwareType,
  intl,
}: {
  firmwareType: EFirmwareType | undefined;
  intl: IntlShape;
}) {
  if (!firmwareType) {
    return '';
  }

  return intl.formatMessage({
    id:
      firmwareType === EFirmwareType.BitcoinOnly
        ? ETranslations.device_firmware_type_btc_only__label
        : ETranslations.device_firmware_type_multichain__label,
  });
}
