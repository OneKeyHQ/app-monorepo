import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  useDevSettingsPersistAtom,
  useFirmwareUpdateDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import {
  getFirmwareVersionTypePrefix,
  getProtocolV2FirmwareVersionDisplayItems,
  getProtocolV2FirmwareVersionTitle,
  shouldHidePro2FirmwareDebugInfo,
} from '../utils';

import { getFirmwareUpdateItems } from './firmwareUpdateInstallViewModel';

/**
 * Parts included in this update, one row each. Production Pro 2 / Neo builds
 * list SafeOS only; developer mode adds the component targets unless the
 * Pro 2 debug-info preference hides them.
 */
export function useFirmwareUpdateItems(
  result: ICheckAllFirmwareReleaseResult | undefined,
) {
  const intl = useIntl();
  const [devSettings] = useDevSettingsPersistAtom();
  const [firmwareDevSettings] = useFirmwareUpdateDevSettingsPersistAtom();
  const hideDebugInfo = shouldHidePro2FirmwareDebugInfo({
    developerModeEnabled: devSettings.enabled,
    hidePro2FirmwareDebugInfo: firmwareDevSettings.hidePro2FirmwareDebugInfo,
    deviceType: result?.deviceType,
  });
  const includeComponents = devSettings.enabled && !hideDebugInfo;

  const items = useMemo(
    () =>
      getFirmwareUpdateItems({
        result,
        protocolV2Items: getProtocolV2FirmwareVersionDisplayItems(result, {
          includeComponents,
        }),
        getProtocolV2Title: (target) =>
          getProtocolV2FirmwareVersionTitle({ target, intl }),
        firmwareLabel: intl.formatMessage({
          id: ETranslations.global_firmware,
        }),
        bootloaderLabel: intl.formatMessage({
          id: ETranslations.global_bootloader,
        }),
        bluetoothLabel: intl.formatMessage({
          id: ETranslations.global_bluetooth,
        }),
        getFirmwareVersionPrefix: getFirmwareVersionTypePrefix,
      }),
    [includeComponents, intl, result],
  );

  return { items, hideDebugInfo };
}
