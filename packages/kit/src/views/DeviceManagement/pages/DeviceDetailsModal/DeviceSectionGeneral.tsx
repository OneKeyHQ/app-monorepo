import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Select, Switch, XStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useStatefulAction } from '@onekeyhq/kit/src/hooks/useStatefulAction';
import {
  useDeviceAutoLockDelayMsAtom,
  useDeviceAutoShutDownDelayMsAtom,
  useDeviceDetailsActions,
  useDeviceHapticFeedbackAtom,
  useDeviceLanguageAtom,
  useDeviceMetaStaticAtom,
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

import { ListItemGroup } from '../ListItemGroup';

const NEVER_LOCK_VALUE = 268_435_456;
const LOCKED_VALUE = 0;

export function LanguageListItem({
  languageOptions,
}: {
  languageOptions: Array<{ label: string; value: string }>;
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
      disabled={stateful.loading}
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
          disabled={stateful.loading}
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
}: {
  autoLockOptions: Array<{ label: string; value: number }>;
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
      disabled={stateful.loading}
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
          disabled={stateful.loading}
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
}: {
  autoShutDownOptions: Array<{ label: string; value: number }>;
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
      disabled={stateful.loading}
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
          disabled={stateful.loading}
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

export function HapticFeedbackListItem() {
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
      {({ value, disabled, onChange }) => (
        <Switch
          size="small"
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </ListItem.StatefulItem>
  );
}

function DeviceSectionGeneral() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const navigation = useAppNavigation();

  const [deviceMeta] = useDeviceMetaStaticAtom();
  const [deviceType] = useDeviceTypeAtom();

  // Load and format language options
  const { result: languageOptions } = usePromiseResult(
    async () => {
      if (!deviceType) return [];
      const options = await deviceUtils.getLanguageConfig({ deviceType });
      return options.map((option) => ({
        label: option.label,
        value: option.code,
      }));
    },
    [deviceType],
    {
      initResult: [],
    },
  );

  // Load and format auto lock options
  const { result: autoLockOptions } = usePromiseResult(
    async () => {
      if (!deviceType) return [];
      const options = await deviceUtils.getAutoLockOptions({ deviceType });
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
    [deviceType, intl],
    {
      initResult: [],
    },
  );

  // Load and format auto shutdown options
  const { result: autoShutDownOptions } = usePromiseResult(
    async () => {
      if (!deviceType) return [];
      const options = await deviceUtils.getAutoShutDownOptions({ deviceType });
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
    [deviceType, intl],
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
  } = useMemo(() => {
    if (!deviceType)
      return {
        showLanguage: false,
        showAutoLock: false,
        showAutoShutDown: false,
        showHapticFeedback: false,
        showBrightness: false,
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
    };
  }, [
    deviceMeta.firmwareVersion,
    deviceType,
    languageOptions,
    autoLockOptions,
    autoShutDownOptions,
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

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      title={intl.formatMessage({
        id: ETranslations.global_general,
      })}
    >
      {showLanguage ? (
        <LanguageListItem languageOptions={languageOptions} />
      ) : null}
      <ListItem
        key="addWallpaper"
        title={intl.formatMessage({
          id: deviceMeta.addWallpaperTitleId,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressHomescreen}
      />
      {showBrightness ? (
        <ListItem
          key="changeBrightness"
          title={intl.formatMessage({
            id: ETranslations.global_brightness,
          })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          drillIn
          onPress={onPressBrightness}
        />
      ) : null}
      {showAutoLock ? (
        <AutoLockListItem autoLockOptions={autoLockOptions} />
      ) : null}
      {showAutoShutDown ? (
        <AutoShutDownListItem autoShutDownOptions={autoShutDownOptions} />
      ) : null}
      {showHapticFeedback ? <HapticFeedbackListItem /> : null}
    </ListItemGroup>
  );
}

export default DeviceSectionGeneral;
