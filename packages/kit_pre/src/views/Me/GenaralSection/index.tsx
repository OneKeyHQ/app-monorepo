import { useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
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
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  ModalScreenProps,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { setLocale, setTheme } from '@onekeyhq/kit/src/store/reducers/settings';
import { supportedHaptics } from '@onekeyhq/shared/src/haptics';

import { SelectTrigger } from '../SelectTrigger';

import { CurrencySelectModal } from './CurrencySelect/types';

import type { CurrencySelectModalParams } from './CurrencySelect/types';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Main>,
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.VolumeHaptic>
>;

type ModalNavigationProps = ModalScreenProps<CurrencySelectModalParams>;

export const GenaralSection = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const modalNavigation = useNavigation<ModalNavigationProps['navigation']>();
  const { dispatch, serviceNotification } = backgroundApiProxy;
  const { theme, locale, selectedFiatMoneySymbol } = useSettings();
  const { themeVariant } = useTheme();
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
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              py={4}
              px={{ base: 4, md: 6 }}
              onPress={() => {
                modalNavigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CurrencySelect,
                  params: {
                    screen: CurrencySelectModal.CurrencySelectHome,
                  },
                });
              }}
            >
              <Icon name="CurrencyDollarOutline" />
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mx={3}
              >
                {intl.formatMessage({
                  id: 'form__fiat_currency',
                })}
              </Text>
              <Box flexDirection="row" alignItems="center">
                <Typography.Body1Strong mr={1}>
                  {selectedFiatMoneySymbol.toLocaleUpperCase()}
                </Typography.Body1Strong>
                <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
              </Box>
            </Pressable>
          </Box>
          {supportedHaptics ? (
            <>
              <Divider />
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
                  <Icon
                    name="ChevronRightMini"
                    color="icon-subdued"
                    size={20}
                  />
                </Box>
              </Pressable>
            </>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};
