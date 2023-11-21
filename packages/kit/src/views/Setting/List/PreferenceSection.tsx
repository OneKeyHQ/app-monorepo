import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useLocaleOptions } from '../hooks';

import { Section } from './Section';

import type { IModalSettingParamList } from '../types';

type IThemeValue = 'light' | 'dark' | 'system';

const ThemeListItem = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onTheme = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingThemeModal,
    });
  }, [navigation]);
  const [{ theme }] = useSettingsPersistAtom();
  const intl = useIntl();
  const themes = useMemo<Record<IThemeValue, string>>(
    () => ({
      'dark': intl.formatMessage({ id: 'form__dark' }),
      'light': intl.formatMessage({ id: 'form__light' }),
      'system': intl.formatMessage({ id: 'form__auto' }),
    }),
    [intl],
  );
  return (
    <ListItem
      onPress={onTheme}
      icon="PaletteOutline"
      title={intl.formatMessage({ id: 'form__theme' })}
      drillIn
    >
      <ListItem.Text
        primary={themes[theme]}
        align="right"
        primaryTextProps={{
          tone: 'subdued',
        }}
      />
    </ListItem>
  );
};

const LocaleListItem = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onLanguage = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingLanguageModal,
    });
  }, [navigation]);
  const locales = useLocaleOptions();
  const labels = useMemo(
    () =>
      locales.reduce((a, b) => {
        a[b.value] = b.label;
        return a;
      }, {} as Record<string, string>),
    [locales],
  );
  const intl = useIntl();
  const [{ locale }] = useSettingsPersistAtom();
  return (
    <ListItem
      onPress={onLanguage}
      icon="GlobusOutline"
      title={intl.formatMessage({ id: 'form__language' })}
      drillIn
    >
      <ListItem.Text
        primary={labels[locale]}
        align="right"
        primaryTextProps={{
          tone: 'subdued',
        }}
      />
    </ListItem>
  );
};

export const PreferenceSection = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingCurrencyModal,
    });
  }, [navigation]);
  const intl = useIntl();
  return (
    <Section title="PREFERENCE">
      <ListItem
        icon="DollarOutline"
        title={intl.formatMessage({ id: 'form__default_currency' })}
        drillIn
        onPress={onPress}
      >
        <ListItem.Text
          primary="USD"
          align="right"
          primaryTextProps={{
            tone: 'subdued',
          }}
        />
      </ListItem>
      <LocaleListItem />
      <ThemeListItem />
    </Section>
  );
};
