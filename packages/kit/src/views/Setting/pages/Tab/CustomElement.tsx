import { Suspense, useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp, ISelectItem } from '@onekeyhq/components';
import {
  ActionList,
  Badge,
  Dialog,
  Select,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { UniversalContainerWithSuspense } from '@onekeyhq/kit/src/components/BiologyAuthComponent/container/UniversalContainer';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBiometricAuthInfo } from '@onekeyhq/kit/src/hooks/useBiometricAuthInfo';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { useLocaleOptions, useResetApp } from '../../hooks';

import { TabSettingsListItem } from './ListItem';

export function LanguageListItem() {
  const locales = useLocaleOptions();
  const intl = useIntl();
  const [{ locale }] = useSettingsPersistAtom();
  const onChange = useCallback(async (text: string) => {
    await backgroundApiProxy.serviceSetting.setLocale(text as ILocaleSymbol);
    setTimeout(() => {
      if (platformEnv.isDesktop) {
        globalThis.desktopApi.changeLanguage(text);
      }
      backgroundApiProxy.serviceApp.restartApp();
    }, 0);
  }, []);

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({ id: ETranslations.global_language })}
      items={locales}
      value={locale}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
      renderTrigger={({ label }) => (
        <ListItem
          userSelect="none"
          icon="TranslateOutline"
          title={intl.formatMessage({ id: ETranslations.global_language })}
        >
          <XStack>
            <ListItem.Text primary={label} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
}

export function ThemeListItem() {
  const [{ theme }] = useSettingsPersistAtom();
  const { setFreezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const intl = useIntl();

  const options = useMemo<ISelectItem[]>(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.global_auto,
        }),
        description: intl.formatMessage({
          id: ETranslations.global_follow_the_system,
        }),
        value: 'system' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_light }),
        value: 'light' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_dark }),
        value: 'dark' as const,
      },
    ],
    [intl],
  );

  const onChange = useCallback(
    async (text: 'light' | 'dark' | 'system') => {
      setFreezeOnBlur(false);
      await backgroundApiProxy.serviceSetting.setTheme(text);
      setFreezeOnBlur(true);
    },
    [setFreezeOnBlur],
  );

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({ id: ETranslations.settings_theme })}
      items={options}
      value={theme}
      onChange={onChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <TabSettingsListItem
          userSelect="none"
          icon="PaletteOutline"
          title={intl.formatMessage({ id: ETranslations.settings_theme })}
        >
          <XStack>
            <ListItem.Text primary={label} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </TabSettingsListItem>
      )}
    />
  );
}

function SuspenseBiologyAuthListItem() {
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  const { title, icon } = useBiometricAuthInfo();

  return isPasswordSet && (biologyAuthIsSupport || webAuthIsSupport) ? (
    <TabSettingsListItem icon={icon} title={title}>
      <UniversalContainerWithSuspense />
    </TabSettingsListItem>
  ) : null;
}

export function BiologyAuthListItem() {
  return (
    <Suspense fallback={null}>
      <SuspenseBiologyAuthListItem />
    </Suspense>
  );
}

export function CleanDataListItem() {
  const intl = useIntl();
  const resetApp = useResetApp();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const toSettingClearAppCachePage = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingClearAppCache);
  }, [navigation]);
  return (
    <ActionList
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({ id: ETranslations.settings_clear_data })}
      renderTrigger={
        <TabSettingsListItem
          title={intl.formatMessage({ id: ETranslations.settings_clear_data })}
          icon="FolderDeleteOutline"
          testID="setting-clear-data"
        >
          <ListItem.DrillIn name="ChevronDownSmallOutline" />
        </TabSettingsListItem>
      }
      items={[
        {
          label: intl.formatMessage({
            id: ETranslations.settings_clear_cache_on_app,
          }),
          onPress: toSettingClearAppCachePage,
        },
        {
          label: intl.formatMessage({
            id: ETranslations.settings_clear_pending_transactions,
          }),
          onPress: () => {
            Dialog.show({
              title: intl.formatMessage({
                id: ETranslations.settings_clear_pending_transactions,
              }),
              description: intl.formatMessage({
                id: ETranslations.settings_clear_pending_transactions_desc,
              }),
              tone: 'destructive',
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_clear,
              }),
              onConfirm: async () => {
                await backgroundApiProxy.serviceSetting.clearPendingTransaction();
                appEventBus.emit(
                  EAppEventBusNames.ClearLocalHistoryPendingTxs,
                  undefined,
                );
                Toast.success({
                  title: intl.formatMessage({
                    id: ETranslations.global_success,
                  }),
                });
              },
            });
          },
        },
        {
          label: intl.formatMessage({ id: ETranslations.settings_reset_app }),
          destructive: true,
          onPress: resetApp,
          testID: 'setting-erase-data',
        },
      ]}
    />
  );
}

export function HardwareTransportTypeListItem() {
  const intl = useIntl();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();

  const transportOptions = useMemo(() => {
    if (platformEnv.isNative) {
      return [
        {
          label: 'Bluetooth',
          value: EHardwareTransportType.BLE,
        },
      ];
    }
    if (platformEnv.isDesktop) {
      return [
        {
          label: 'Bridge',
          value: EHardwareTransportType.Bridge,
        },
      ];
    }
    if (platformEnv.isSupportWebUSB) {
      return [
        {
          label: 'WebUSB',
          value: EHardwareTransportType.WEBUSB,
          iconProps: { name: 'UsbOutline' as const },
        },
        {
          label: 'Bridge',
          value: EHardwareTransportType.Bridge,
        },
      ];
    }
    return [];
  }, []);
  const onChange = useCallback(async (value: string) => {
    if (platformEnv.isWeb || platformEnv.isExtension) {
      await backgroundApiProxy.serviceHardware.switchTransport({
        transportType: value as EHardwareTransportType,
      });
    }
    await backgroundApiProxy.serviceSetting.setHardwareTransportType(
      value as EHardwareTransportType,
    );
  }, []);

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({
        id: ETranslations.device_hardware_communication,
      })}
      items={transportOptions}
      value={hardwareTransportType}
      onChange={onChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <TabSettingsListItem
          userSelect="none"
          icon="UsbOutline"
          title={intl.formatMessage({
            id: ETranslations.device_hardware_communication,
          })}
        >
          <XStack>
            <ListItem.Text primary={label} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </TabSettingsListItem>
      )}
    />
  );
}

export function ListVersionItem() {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo();
  const handleToUpdatePreviewPage = useCallback(() => {
    appUpdateInfo.toUpdatePreviewPage();
  }, [appUpdateInfo]);
  return appUpdateInfo.isNeedUpdate ? (
    <TabSettingsListItem
      onPress={handleToUpdatePreviewPage}
      icon="InfoCircleOutline"
      iconProps={{ color: '$textInfo' }}
      title={intl.formatMessage({
        id: ETranslations.settings_app_update_available,
      })}
      titleProps={{ color: '$textInfo' }}
      drillIn
    >
      <ListItem.Text
        primary={
          <Badge badgeType="info" badgeSize="lg">
            {appUpdateInfo.data.latestVersion}
          </Badge>
        }
        align="right"
      />
    </TabSettingsListItem>
  ) : (
    <TabSettingsListItem
      onPress={appUpdateInfo.onViewReleaseInfo}
      icon="InfoCircleOutline"
      title={intl.formatMessage({ id: ETranslations.settings_whats_new })}
      drillIn
    >
      <ListItem.Text primary={platformEnv.version} align="right" />
    </TabSettingsListItem>
  );
}
