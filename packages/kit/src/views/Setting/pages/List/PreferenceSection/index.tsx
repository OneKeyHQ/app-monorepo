import { useCallback, useContext, useEffect, useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { Select, XStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Section } from '@onekeyhq/kit/src/components/Section';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations, type ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { useLocaleOptions } from '../../../hooks';

type IThemeValue = 'light' | 'dark' | 'system';

const ThemeListItem = () => {
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
    async (text: IThemeValue) => {
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
        <ListItem
          userSelect="none"
          icon="PaletteOutline"
          title={intl.formatMessage({ id: ETranslations.settings_theme })}
        >
          <XStack>
            <ListItem.Text primary={label} align="right" />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>
      )}
    />
  );
};

const LanguageListItem = () => {
  const locales = useLocaleOptions();
  const intl = useIntl();
  const [{ locale, currencyInfo }] = useSettingsPersistAtom();
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
};

const CurrencyListItem = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingCurrencyModal);
  }, [navigation]);
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const text = settings.currencyInfo?.id ?? '';
  return (
    <ListItem
      userSelect="none"
      icon="DollarOutline"
      title={intl.formatMessage({
        id: ETranslations.settings_default_currency,
      })}
      drillIn
      onPress={onPress}
    >
      <ListItem.Text primary={text.toUpperCase()} align="right" />
    </ListItem>
  );
};

const NotificationsListItem = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const intl = useIntl();
  const handleOnPress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingNotifications);
  }, [navigation]);

  if (platformEnv.isWeb) {
    return null;
  }

  return (
    <ListItem
      icon="BellOutline"
      title={intl.formatMessage({ id: ETranslations.global_notifications })}
      drillIn
      onPress={handleOnPress}
    />
  );
};

export const PreferenceSection = () => {
  const intl = useIntl();
  return (
    <Section
      title={intl.formatMessage({ id: ETranslations.global_preferences })}
    >
      <CurrencyListItem />
      <LanguageListItem />
      <ThemeListItem />
      <NotificationsListItem />
    </Section>
  );
};
