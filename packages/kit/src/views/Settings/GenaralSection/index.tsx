import React from 'react';

import { useIntl } from 'react-intl';

import { Box, Select, Typography } from '@onekeyhq/components';
import { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';
import { useAppDispatch, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { setLocale, setTheme } from '@onekeyhq/kit/src/store/reducers/settings';

import { SelectTrigger } from '../SelectTrigger';

export const GenaralSection = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { theme, locale } = useSettings();

  return (
    <Box w="full" mb="4" zIndex={10} shadow="depth.2">
      <Box p="2">
        <Typography.Subheading>
          {intl.formatMessage({
            id: 'form__general_uppercase',
            defaultMessage: 'GENERAL',
          })}
        </Typography.Subheading>
      </Box>
      <Box borderRadius="12" bg="surface-default" shadow="depth.2">
        <Box>
          <Box w="full" zIndex={99}>
            <Select<ThemeVariant | 'system'>
              title={intl.formatMessage({
                id: 'form__theme',
                defaultMessage: 'Theme',
              })}
              isTriggerPlain
              footer={null}
              headerShown={false}
              defaultValue={theme}
              onChange={(value) => dispatch(setTheme(value))}
              options={[
                {
                  label: intl.formatMessage({
                    id: 'form__system',
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
              renderTrigger={(activeOption) => (
                <SelectTrigger
                  title={intl.formatMessage({
                    id: 'form__theme',
                    defaultMessage: 'Theme',
                  })}
                  activeOption={activeOption}
                />
              )}
            />
          </Box>
          <Box w="full" zIndex={98}>
            <Select
              title={intl.formatMessage({
                id: 'form__language',
                defaultMessage: 'Language',
              })}
              isTriggerPlain
              footer={null}
              defaultValue={locale}
              headerShown={false}
              onChange={(l) => dispatch(setLocale(l as 'zh-CN'))}
              options={[
                { label: '简体中文', value: 'zh-CN' },
                { label: 'English', value: 'en-US' },
              ]}
              dropdownProps={{ width: '64' }}
              dropdownPosition="right"
              renderTrigger={(activeOption) => (
                <SelectTrigger
                  title={intl.formatMessage({
                    id: 'form__language',
                    defaultMessage: 'Language',
                  })}
                  activeOption={activeOption}
                />
              )}
            />
          </Box>
          <Box w="full" zIndex={97}>
            <Select
              title={intl.formatMessage({
                id: 'form__fiat_currency',
                defaultMessage: 'Fiat currency',
              })}
              isTriggerPlain
              footer={null}
              headerShown={false}
              defaultValue="USD"
              options={[
                {
                  label: 'CNY',
                  value: 'CNY',
                },
                {
                  label: 'USD',
                  value: 'USD',
                },
                {
                  label: 'KRW',
                  value: 'KRW',
                },
                {
                  label: 'GBP',
                  value: 'GBP',
                },
                {
                  label: 'EUR',
                  value: 'EUR',
                },
              ]}
              dropdownProps={{ width: '64' }}
              dropdownPosition="right"
              renderTrigger={(activeOption) => (
                <SelectTrigger
                  title={intl.formatMessage({
                    id: 'form__fiat_currency',
                    defaultMessage: 'Fiat currency',
                  })}
                  hideDivider
                  activeOption={activeOption}
                />
              )}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
