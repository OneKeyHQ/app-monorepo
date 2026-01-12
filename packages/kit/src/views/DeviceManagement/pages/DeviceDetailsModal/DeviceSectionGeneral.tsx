import { useCallback, useMemo } from 'react';

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
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { ListItemGroup } from '../ListItemGroup';

const NEVER_LOCK_VALUE = 268_435_456;
const LOCKED_VALUE = 0;

export function LanguageListItem() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const [deviceType] = useDeviceTypeAtom();

  const [language] = useDeviceLanguageAtom();

  const stateful = useStatefulAction<string>({
    value: language || 'en',
    onAction: actions.updateLanguage,
  });

  const { result: languageOptions } = usePromiseResult(async () => {
    if (!deviceType) return [];
    const options = await deviceUtils.getLanguageConfig({ deviceType });
    return options.map((option) => {
      return {
        label: option.label,
        value: option.code,
      };
    });
  }, [deviceType]);

  const { displayLabel } = useMemo(() => {
    const label =
      languageOptions?.find((o) => o.value === stateful.value)?.label ||
      intl.formatMessage({ id: ETranslations.global_unknown });
    return { displayLabel: label };
  }, [stateful.value, languageOptions, intl]);

  if (!languageOptions || languageOptions.length === 0) return null;

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
          borderRadius="$0"
          title={intl.formatMessage({
            id: ETranslations.global_language,
          })}
          disabled={stateful.loading}
        >
          <XStack alignItems="center">
            <ListItem.Text primary={displayLabel} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
}

export function AutoLockListItem() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const [deviceType] = useDeviceTypeAtom();

  const [autoLockDelayMs] = useDeviceAutoLockDelayMsAtom();
  const stateful = useStatefulAction<number>({
    value: autoLockDelayMs || 0,
    onAction: actions.updateAutoLockDelayMs,
  });

  const { result: autoLockOptions } = usePromiseResult(async () => {
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
  }, [deviceType, intl]);

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
      label = option?.label || `${(stateful.value || 0) / 1000}s`;
    }

    return { displayLabel: label, isLocked: locked };
  }, [stateful.value, autoLockOptions, intl]);

  if (!autoLockOptions || autoLockOptions.length === 0) return null;

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
          borderRadius="$0"
          title={intl.formatMessage({
            id: ETranslations.global_auto_lock,
          })}
          disabled={stateful.loading}
        >
          <XStack alignItems="center">
            <ListItem.Text primary={displayLabel} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
}

export function AutoShutDownListItem() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const [deviceType] = useDeviceTypeAtom();

  const [autoShutDownDelayMs] = useDeviceAutoShutDownDelayMsAtom();
  const stateful = useStatefulAction<number>({
    value: autoShutDownDelayMs || 0,
    onAction: actions.updateAutoShutDownDelayMs,
  });

  const { result: autoShutDownOptions } = usePromiseResult(async () => {
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
  }, [deviceType, intl]);

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
      label = option?.label || `${(stateful.value || 0) / 1000}s`;
    }

    return { displayLabel: label, isLocked: locked };
  }, [stateful.value, autoShutDownOptions, intl]);

  if (!autoShutDownOptions || autoShutDownOptions.length === 0) return null;

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
          borderRadius="$0"
          title={intl.formatMessage({
            id: ETranslations.global_auto_shutdown,
          })}
          disabled={stateful.loading}
        >
          <XStack alignItems="center">
            <ListItem.Text primary={displayLabel} align="right" />
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
      itemProps={{ h: '$12' }}
      title={intl.formatMessage({
        id: ETranslations.global_general,
      })}
    >
      <LanguageListItem />
      <ListItem
        key="addWallpaper"
        title={intl.formatMessage({
          id: deviceMeta.addWallpaperTitleId,
        })}
        drillIn
        onPress={onPressHomescreen}
      />
      <ListItem
        key="changeBrightness"
        title={intl.formatMessage({
          id: ETranslations.global_brightness,
        })}
        drillIn
        onPress={onPressBrightness}
      />
      <AutoLockListItem />
      <AutoShutDownListItem />
      <HapticFeedbackListItem />
    </ListItemGroup>
  );
}

export default DeviceSectionGeneral;
