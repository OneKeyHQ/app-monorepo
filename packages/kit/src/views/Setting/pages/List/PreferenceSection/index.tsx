import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { Select, XStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { useLocaleOptions } from '../../../hooks';
import { Section } from '../Section';

type IThemeValue = 'light' | 'dark' | 'system';

const ThemeListItem = () => {
  const [{ theme }] = useSettingsPersistAtom();
  const intl = useIntl();

  const options = useMemo<ISelectItem[]>(
    () => [
      {
        label: intl.formatMessage({ id: 'form__auto' }),
        description: 'Follow the system',
        value: 'system' as const,
      },
      {
        label: intl.formatMessage({ id: 'form__light' }),
        value: 'light' as const,
      },
      {
        label: intl.formatMessage({ id: 'form__dark' }),
        value: 'dark' as const,
      },
    ],
    [intl],
  );

  const onChange = useCallback(
    async (text: IThemeValue) =>
      backgroundApiProxy.serviceSetting.setTheme(text),
    [],
  );

  return (
    <Select
      title={intl.formatMessage({ id: 'form__theme' })}
      items={options}
      value={theme}
      onChange={onChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <ListItem
          icon="PaletteOutline"
          title={intl.formatMessage({ id: 'form__theme' })}
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
  const [{ locale }] = useSettingsPersistAtom();
  const onChange = useCallback(async (text: string) => {
    await backgroundApiProxy.serviceSetting.setLocale(text as ILocaleSymbol);
  }, []);
  return (
    <Select
      title={intl.formatMessage({ id: 'form__language' })}
      items={locales}
      value={locale}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 300 }}
      sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
      renderTrigger={({ label }) => (
        <ListItem
          icon="GlobusOutline"
          title={intl.formatMessage({ id: 'form__language' })}
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
      icon="DollarOutline"
      title={intl.formatMessage({ id: 'form__default_currency' })}
      drillIn
      onPress={onPress}
    >
      <ListItem.Text primary={text.toUpperCase()} align="right" />
    </ListItem>
  );
};

export const PreferenceSection = () => (
  <Section title="Preferences">
    <CurrencyListItem />
    <LanguageListItem />
    <ThemeListItem />
  </Section>
);
