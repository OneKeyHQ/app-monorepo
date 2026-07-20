import { useCallback, useMemo } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Select, Switch, XStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useStatefulAction } from '@onekeyhq/kit/src/hooks/useStatefulAction';
import {
  canEditPro2DeviceWideSettings,
  useDeviceAtom,
  useDeviceAutoLockDelayMsAtom,
  useDeviceAutoShutDownDelayMsAtom,
  useDeviceBrightnessAtom,
  useDeviceDetailsActions,
  useDeviceHapticFeedbackAtom,
  useDeviceLanguageAtom,
  useDeviceMetaStaticAtom,
  useDeviceSettingsAccessibleAtom,
  useDeviceTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import deviceUtils, {
  ESupportSettings,
} from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { DeviceManagementTestIDs } from '../../testIDs';
import { ListItemGroup } from '../ListItemGroup';

import { TREZOR_AUTO_LOCK_OPTIONS } from './utils';

const NEVER_LOCK_VALUE = 268_435_456;
const LOCKED_VALUE = 0;

type IDeviceLanguageOption = {
  label: string;
  code: string;
};

type IDeviceDelayOption = {
  seconds: number;
  minute: number;
  hour: number;
  day: number;
};

const PRO2_BRIGHTNESS_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 10;
  return { label: `${value}%`, value };
});

function getDurationLabel({
  intl,
  option,
}: {
  intl: ReturnType<typeof useIntl>;
  option: (typeof TREZOR_AUTO_LOCK_OPTIONS)[number];
}) {
  if ('minute' in option) {
    return intl.formatMessage(
      { id: ETranslations.earn_number_minutes },
      { number: option.minute },
    );
  }
  if ('hour' in option) {
    return intl.formatMessage(
      { id: ETranslations.earn_number_hours },
      { number: option.hour },
    );
  }
  return intl.formatMessage(
    { id: ETranslations.earn_number_days },
    { number: option.day },
  );
}

function isNumberFeature(features: Record<string, unknown>, field: string) {
  return typeof features[field] === 'number';
}

function isBooleanFeature(features: Record<string, unknown>, field: string) {
  return typeof features[field] === 'boolean';
}

export function LanguageListItem({
  languageOptions,
  disabled,
}: {
  languageOptions: Array<{ label: string; value: string }>;
  disabled?: boolean;
}) {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();

  const [language] = useDeviceLanguageAtom();

  const stateful = useStatefulAction<string>({
    value: language || 'en',
    onAction: actions.updateLanguage,
  });

  const { displayLabel } = useMemo(() => {
    const label =
      languageOptions?.find((o) => o.value === stateful.value)?.label ||
      intl.formatMessage({ id: ETranslations.global_unknown });
    return { displayLabel: label };
  }, [stateful.value, languageOptions, intl]);

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      items={languageOptions}
      value={stateful.value}
      onChange={stateful.onChange}
      placement="bottom-end"
      title={intl.formatMessage({
        id: ETranslations.global_language,
      })}
      disabled={disabled || stateful.loading}
      testID={DeviceManagementTestIDs.languageSelect}
      renderTrigger={() => (
        <ListItem
          mx="$0"
          px="$5"
          py="$3"
          borderRadius="$0"
          $gtMd={{ py: '$0' }}
          title={intl.formatMessage({
            id: ETranslations.global_language,
          })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          disabled={disabled || stateful.loading}
        >
          <XStack alignItems="center">
            <ListItem.Text
              primary={displayLabel}
              align="right"
              primaryTextProps={{
                size: '$bodyMdMedium',
                color: '$textSubdued',
              }}
            />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
}

export function AutoLockListItem({
  autoLockOptions,
  disabled,
}: {
  autoLockOptions: Array<{ label: string; value: number }>;
  disabled?: boolean;
}) {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();

  const [autoLockDelayMs] = useDeviceAutoLockDelayMsAtom();
  const stateful = useStatefulAction<number>({
    value: autoLockDelayMs || 0,
    onAction: actions.updateAutoLockDelayMs,
  });

  const { displayLabel } = useMemo(() => {
    const locked = stateful.value === LOCKED_VALUE;
    const never = stateful.value === NEVER_LOCK_VALUE;

    let label = '';
    if (locked) {
      label = intl.formatMessage({ id: ETranslations.global_settings });
    } else if (never) {
      label = intl.formatMessage({ id: ETranslations.global_never });
    } else {
      const option = autoLockOptions?.find((o) => o.value === stateful.value);
      const seconds = new BigNumber(stateful.value).dividedBy(1000).toFixed();
      label = option?.label || `${seconds}s`;
    }

    return { displayLabel: label, isLocked: locked };
  }, [stateful.value, autoLockOptions, intl]);

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      items={autoLockOptions}
      value={stateful.value}
      onChange={stateful.onChange}
      placement="bottom-end"
      title={intl.formatMessage({
        id: ETranslations.global_auto_lock,
      })}
      disabled={disabled || stateful.loading}
      testID={DeviceManagementTestIDs.autoLockSelect}
      renderTrigger={() => (
        <ListItem
          mx="$0"
          px="$5"
          py="$3"
          borderRadius="$0"
          $gtMd={{ py: '$0' }}
          title={intl.formatMessage({
            id: ETranslations.global_auto_lock,
          })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          disabled={disabled || stateful.loading}
        >
          <XStack alignItems="center">
            <ListItem.Text
              primary={displayLabel}
              align="right"
              primaryTextProps={{
                size: '$bodyMdMedium',
                color: '$textSubdued',
              }}
            />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
}

export function AutoShutDownListItem({
  autoShutDownOptions,
  disabled,
}: {
  autoShutDownOptions: Array<{ label: string; value: number }>;
  disabled?: boolean;
}) {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();

  const [autoShutDownDelayMs] = useDeviceAutoShutDownDelayMsAtom();
  const stateful = useStatefulAction<number>({
    value: autoShutDownDelayMs || 0,
    onAction: actions.updateAutoShutDownDelayMs,
  });

  const { displayLabel } = useMemo(() => {
    const locked = stateful.value === LOCKED_VALUE;
    const never = stateful.value === NEVER_LOCK_VALUE;

    let label = '';
    if (locked) {
      label = intl.formatMessage({ id: ETranslations.global_settings });
    } else if (never) {
      label = intl.formatMessage({ id: ETranslations.global_never });
    } else {
      const option = autoShutDownOptions?.find(
        (o) => o.value === stateful.value,
      );
      const seconds = new BigNumber(stateful.value).dividedBy(1000).toFixed();
      label = option?.label || `${seconds}s`;
    }

    return { displayLabel: label, isLocked: locked };
  }, [stateful.value, autoShutDownOptions, intl]);

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      items={autoShutDownOptions}
      value={stateful.value}
      onChange={stateful.onChange}
      placement="bottom-end"
      title={intl.formatMessage({
        id: ETranslations.global_auto_shutdown,
      })}
      disabled={disabled || stateful.loading}
      testID={DeviceManagementTestIDs.autoShutDownSelect}
      renderTrigger={() => (
        <ListItem
          mx="$0"
          px="$5"
          py="$3"
          borderRadius="$0"
          $gtMd={{ py: '$0' }}
          title={intl.formatMessage({
            id: ETranslations.global_auto_shutdown,
          })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          disabled={disabled || stateful.loading}
        >
          <XStack alignItems="center">
            <ListItem.Text
              primary={displayLabel}
              align="right"
              primaryTextProps={{
                size: '$bodyMdMedium',
                color: '$textSubdued',
              }}
            />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
}

export function HapticFeedbackListItem({
  disabled: settingsDisabled,
}: {
  disabled?: boolean;
}) {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const [hapticFeedback] = useDeviceHapticFeedbackAtom();
  const onUpdateHapticFeedback = useCallback(
    async (value: boolean) => {
      await actions.updateHapticFeedback(value);
    },
    [actions],
  );

  return (
    <ListItem.StatefulItem
      mx="$0"
      px="$5"
      borderRadius="$0"
      title={intl.formatMessage({
        id: ETranslations.global_vibration_haptic,
      })}
      titleProps={{ size: '$bodyMdMedium', color: '$text' }}
      value={hapticFeedback}
      onAction={onUpdateHapticFeedback}
    >
      {({ value, disabled: actionDisabled, onChange }) => (
        <Switch
          size="small"
          value={value}
          onChange={onChange}
          disabled={settingsDisabled || actionDisabled}
          testID={DeviceManagementTestIDs.hapticFeedbackSwitch}
        />
      )}
    </ListItem.StatefulItem>
  );
}

function Pro2BrightnessListItem({ disabled }: { disabled?: boolean }) {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const [brightness] = useDeviceBrightnessAtom();
  const stateful = useStatefulAction<number>({
    value: brightness ?? 50,
    onAction: actions.updateBrightness,
  });

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      items={PRO2_BRIGHTNESS_OPTIONS}
      value={stateful.value}
      onChange={stateful.onChange}
      placement="bottom-end"
      title={intl.formatMessage({ id: ETranslations.global_brightness })}
      disabled={disabled || stateful.loading}
      testID={DeviceManagementTestIDs.brightnessItem}
      renderTrigger={() => (
        <ListItem
          mx="$0"
          px="$5"
          py="$3"
          borderRadius="$0"
          $gtMd={{ py: '$0' }}
          title={intl.formatMessage({ id: ETranslations.global_brightness })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          disabled={disabled || stateful.loading}
        >
          <XStack alignItems="center">
            <ListItem.Text
              primary={`${stateful.value}%`}
              align="right"
              primaryTextProps={{
                size: '$bodyMdMedium',
                color: '$textSubdued',
              }}
            />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
}

function DeviceSectionGeneral() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const navigation = useAppNavigation();

  const [deviceMeta] = useDeviceMetaStaticAtom();
  const [deviceType] = useDeviceTypeAtom();
  const [deviceSettingsAccessible] = useDeviceSettingsAccessibleAtom();
  const [device] = useDeviceAtom();
  const isTrezor = device?.vendor === EHardwareVendor.trezor;
  const generalSettingsDisabled =
    deviceType === EDeviceType.Pro2
      ? !canEditPro2DeviceWideSettings({
          unlocked: Boolean(deviceSettingsAccessible),
        })
      : !deviceSettingsAccessible;
  const trezorFeatures = useMemo(
    () => (device?.featuresInfo ?? {}) as Record<string, unknown>,
    [device?.featuresInfo],
  );

  // Load and format language options
  const { result: languageOptions } = usePromiseResult(
    async () => {
      if (isTrezor) return [];
      if (!deviceType) return [];
      const options = (await deviceUtils.getLanguageConfig({
        deviceType,
      })) as IDeviceLanguageOption[];
      return options.map((option) => ({
        label: option.label,
        value: option.code,
      }));
    },
    [deviceType, isTrezor],
    {
      initResult: [],
    },
  );

  // Load and format auto lock options
  const { result: autoLockOptions } = usePromiseResult(
    async () => {
      if (isTrezor) {
        return TREZOR_AUTO_LOCK_OPTIONS.map((option) => ({
          label: getDurationLabel({ intl, option }),
          value: timerUtils.getTimeDurationMs(option),
        }));
      }
      if (!deviceType) return [];
      const options = (await deviceUtils.getAutoLockOptions({
        deviceType,
      })) as IDeviceDelayOption[];
      return options.map((option) => {
        const value = timerUtils.getTimeDurationMs(option);
        if (
          option.seconds === 0 &&
          option.minute === 0 &&
          option.hour === 0 &&
          option.day === 0
        ) {
          return {
            label: intl.formatMessage({ id: ETranslations.global_never }),
            value: NEVER_LOCK_VALUE,
          };
        }

        const label = option.seconds
          ? intl.formatMessage(
              { id: ETranslations.earn_number_seconds },
              { number: option.seconds },
            )
          : intl.formatMessage(
              { id: ETranslations.earn_number_minutes },
              { number: option.minute },
            );
        return { label, value };
      });
    },
    [deviceType, intl, isTrezor],
    {
      initResult: [],
    },
  );

  // Load and format auto shutdown options
  const { result: autoShutDownOptions } = usePromiseResult(
    async () => {
      if (isTrezor) return [];
      if (!deviceType) return [];
      const options = (await deviceUtils.getAutoShutDownOptions({
        deviceType,
      })) as IDeviceDelayOption[];
      return options.map((option) => {
        const value = timerUtils.getTimeDurationMs(option);
        if (
          option.seconds === 0 &&
          option.minute === 0 &&
          option.hour === 0 &&
          option.day === 0
        ) {
          return {
            label: intl.formatMessage({ id: ETranslations.global_never }),
            value: NEVER_LOCK_VALUE,
          };
        }
        const label = option.seconds
          ? intl.formatMessage(
              { id: ETranslations.earn_number_seconds },
              { number: option.seconds },
            )
          : intl.formatMessage(
              { id: ETranslations.earn_number_minutes },
              { number: option.minute },
            );
        return { label, value };
      });
    },
    [deviceType, intl, isTrezor],
    {
      initResult: [],
    },
  );

  const {
    showLanguage,
    showAutoLock,
    showAutoShutDown,
    showHapticFeedback,
    showBrightness,
    showWallpaper,
  } = useMemo(() => {
    if (isTrezor) {
      return {
        showLanguage: false,
        showAutoLock:
          isNumberFeature(trezorFeatures, 'auto_lock_delay_ms') &&
          autoLockOptions.length > 0,
        showAutoShutDown: false,
        showHapticFeedback: isBooleanFeature(trezorFeatures, 'haptic_feedback'),
        showBrightness:
          isNumberFeature(trezorFeatures, 'homescreen_width') &&
          isNumberFeature(trezorFeatures, 'homescreen_height'),
        showWallpaper: false,
      };
    }

    if (!deviceType)
      return {
        showLanguage: false,
        showAutoLock: false,
        showAutoShutDown: false,
        showHapticFeedback: false,
        showBrightness: false,
        showWallpaper: false,
      };

    const supportLanguage = deviceUtils.supportSettings({
      deviceType,
      firmwareVersion: deviceMeta.firmwareVersion,
      setting: ESupportSettings.Language,
    });
    const supportAutoLock = deviceUtils.supportSettings({
      deviceType,
      firmwareVersion: deviceMeta.firmwareVersion,
      setting: ESupportSettings.AutoLock,
    });
    const supportAutoShutDown = deviceUtils.supportSettings({
      deviceType,
      firmwareVersion: deviceMeta.firmwareVersion,
      setting: ESupportSettings.AutoShutDown,
    });
    const supportHapticFeedback = deviceUtils.supportSettings({
      deviceType,
      firmwareVersion: deviceMeta.firmwareVersion,
      setting: ESupportSettings.HapticFeedback,
    });
    const supportBrightness = deviceUtils.supportSettings({
      deviceType,
      firmwareVersion: deviceMeta.firmwareVersion,
      setting: ESupportSettings.Brightness,
    });

    return {
      showLanguage:
        supportLanguage && languageOptions && languageOptions.length > 0,
      showAutoLock:
        supportAutoLock && autoLockOptions && autoLockOptions.length > 0,
      showAutoShutDown:
        supportAutoShutDown &&
        autoShutDownOptions &&
        autoShutDownOptions.length > 0,
      showHapticFeedback: supportHapticFeedback,
      showBrightness: supportBrightness,
      showWallpaper: true,
    };
  }, [
    deviceMeta.firmwareVersion,
    deviceType,
    languageOptions,
    autoLockOptions,
    autoShutDownOptions,
    isTrezor,
    trezorFeatures,
  ]);

  const onPressHomescreen = useCallback(async () => {
    const deviceData = await actions.getWalletWithDevice();
    if (!deviceData?.device) return;
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.HardwareHomeScreenModal,
      params: {
        device: deviceData.device,
      },
    });
  }, [navigation, actions]);

  const onPressBrightness = useCallback(async () => {
    await actions.updateBrightness();
  }, [actions]);

  // No items → hide the whole section (incl. the "General" title). e.g. an
  // older Trezor without auto-lock/haptics/brightness features.
  const hasVisibleItem =
    showLanguage ||
    showWallpaper ||
    showBrightness ||
    showAutoLock ||
    showAutoShutDown ||
    showHapticFeedback;

  if (!hasVisibleItem) {
    return null;
  }

  const brightnessItem =
    deviceType === EDeviceType.Pro2 ? (
      <Pro2BrightnessListItem disabled={generalSettingsDisabled} />
    ) : (
      <ListItem
        key="changeBrightness"
        title={intl.formatMessage({
          id: ETranslations.global_brightness,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressBrightness}
        testID={DeviceManagementTestIDs.brightnessItem}
      />
    );

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      title={intl.formatMessage({
        id: ETranslations.global_general,
      })}
    >
      {showLanguage ? (
        <LanguageListItem
          languageOptions={languageOptions}
          disabled={generalSettingsDisabled}
        />
      ) : null}
      {showWallpaper ? (
        <ListItem
          key="addWallpaper"
          title={intl.formatMessage({
            id: deviceMeta.addWallpaperTitleId,
          })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          drillIn
          onPress={onPressHomescreen}
          testID={DeviceManagementTestIDs.wallpaperItem}
        />
      ) : null}
      {showBrightness ? brightnessItem : null}
      {showAutoLock ? (
        <AutoLockListItem
          autoLockOptions={autoLockOptions}
          disabled={generalSettingsDisabled}
        />
      ) : null}
      {showAutoShutDown ? (
        <AutoShutDownListItem
          autoShutDownOptions={autoShutDownOptions}
          disabled={generalSettingsDisabled}
        />
      ) : null}
      {showHapticFeedback ? (
        <HapticFeedbackListItem disabled={generalSettingsDisabled} />
      ) : null}
    </ListItemGroup>
  );
}

export default DeviceSectionGeneral;
