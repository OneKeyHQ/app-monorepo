import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/components';
import { LOCALES_OPTION } from '@onekeyhq/components/src/locale';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import {
  type ISettingsPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useLocaleOptions } from '../hooks';

import { Section } from './Section';

import type { IModalSettingParamList } from '../types';

const themes: Record<ISettingsPersistAtom['theme'], string> = {
  'dark': 'Dark',
  'light': 'Light',
  'system': 'Auto',
};

const ThemeListItem = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onTheme = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingThemeModal,
    });
  }, [navigation]);
  const [{ theme }] = useSettingsPersistAtom();
  return (
    <ListItem onPress={onTheme} icon="PaletteOutline" title="Theme" drillIn>
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

  const [{ locale }] = useSettingsPersistAtom();
  return (
    <ListItem
      onPress={onLanguage}
      icon="GlobusOutline"
      title="Language"
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
  return (
    <Section title="PREFERENCE">
      <ListItem
        icon="DollarOutline"
        title="Default currency"
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
