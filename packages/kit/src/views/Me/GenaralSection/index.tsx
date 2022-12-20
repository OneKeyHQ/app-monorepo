import { useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Select,
  Text,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { LOCALES_OPTION } from '@onekeyhq/components/src/locale';
import type { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppSelector, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import type {
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/types';
import {
  setLocale,
  setSelectedFiatMoneySymbol,
  setTheme,
} from '@onekeyhq/kit/src/store/reducers/settings';
import { supportedHaptics } from '@onekeyhq/shared/src/haptics';

import { SelectTrigger } from '../SelectTrigger';

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Root>,
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.VolumeHaptic>
>;

export const GenaralSection = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { dispatch, serviceNotification } = backgroundApiProxy;
  const { theme, locale, selectedFiatMoneySymbol } = useSettings();
  const { themeVariant } = useTheme();

  const fiatMoneySymbolList = useAppSelector((s) => s.fiatMoney.symbolList);
  const localeOptions = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({
            id: 'form__auto',
            defaultMessage: 'System',
          }),
          value: 'system',
        },
      ].concat(LOCALES_OPTION),
    [intl],
  );

  return (
    <Box w="full" mb="6">
      <Box pb={2}>
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({
            id: 'form__general_uppercase',
            defaultMessage: 'GENERAL',
          })}
        </Typography.Subheading>
      </Box>
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        <Box>
          <Box w="full">
            <Select<ThemeVariant | 'system'>
              title={intl.formatMessage({
                id: 'form__theme',
                defaultMessage: 'Theme',
              })}
              isTriggerPlain
              footer={null}
              headerShown={false}
              defaultValue={theme}
              onChange={(value) => {
                dispatch(setTheme(value));
              }}
              options={[
                {
                  label: intl.formatMessage({
                    id: 'form__auto',
                    defaultMessage: 'System',
                  }),
                  value: 'system',
                },
                {
                  label: intl.formatMessage({
                    id: 'form__light',
                    defaultMessage: 'Light',
                  }),
                  value: 'light',
                },
                {
                  label: intl.formatMessage({
                    id: 'form__dark',
                    defaultMessage: 'Dark',
                  }),
                  value: 'dark',
                },
              ]}
              dropdownProps={{ width: '64' }}
              dropdownPosition="right"
              renderTrigger={({ activeOption }) => (
                <SelectTrigger
                  title={intl.formatMessage({
                    id: 'form__theme',
                    defaultMessage: 'Theme',
                  })}
                  activeOption={activeOption}
                  iconName="SunOutline"
                />
              )}
            />
          </Box>
          <Box w="full">
            <Select
              title={intl.formatMessage({
                id: 'form__language',
                defaultMessage: 'Language',
              })}
              isTriggerPlain
              footer={null}
              defaultValue={locale}
              headerShown={false}
              onChange={(l) => {
                dispatch(setLocale(l as 'zh-CN'));
                serviceNotification.syncPushNotificationConfig();
              }}
              options={localeOptions}
              dropdownProps={{ width: '64' }}
              dropdownPosition="right"
              renderTrigger={({ activeOption }) => (
                <SelectTrigger
                  title={intl.formatMessage({
                    id: 'form__language',
                    defaultMessage: 'Language',
                  })}
                  activeOption={activeOption}
                  iconName="LanguageOutline"
                />
              )}
            />
          </Box>
          <Box w="full">
            <Select<string>
              title={intl.formatMessage({
                id: 'form__fiat_currency',
              })}
              isTriggerPlain
              footer={null}
              headerShown={false}
              value={selectedFiatMoneySymbol ?? 'usd'}
              onChange={(value) => {
                dispatch(setSelectedFiatMoneySymbol(value));
                serviceNotification.syncPushNotificationConfig();
              }}
              options={fiatMoneySymbolList.map((symbol) => ({
                label: symbol.toUpperCase(),
                value: symbol,
              }))}
              dropdownProps={{ width: '64' }}
              dropdownPosition="right"
              renderTrigger={({ activeOption }) => (
                <SelectTrigger
                  title={intl.formatMessage({
                    id: 'form__fiat_currency',
                  })}
                  hideDivider={!supportedHaptics}
                  activeOption={activeOption}
                  iconName="CurrencyDollarOutline"
                />
              )}
            />
          </Box>
          {supportedHaptics ? (
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              py={4}
              px={{ base: 4, md: 6 }}
              onPress={() => {
                navigation.navigate(HomeRoutes.VolumeHaptic);
              }}
            >
              <Icon name="SpeakerWaveOutline" />
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mx={3}
              >
                {intl.formatMessage({
                  id: 'form__sound_n_vibration',
                })}
              </Text>
              <Box>
                <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
              </Box>
            </Pressable>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};
