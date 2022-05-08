import React from 'react';

import { useIntl } from 'react-intl';

import { Box, Select, Typography } from '@onekeyhq/components';
import { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';
import { useAppSelector, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  setLocale,
  setSelectedFiatMoneySymbol,
  setTheme,
} from '@onekeyhq/kit/src/store/reducers/settings';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { SelectTrigger } from '../SelectTrigger';

export const GenaralSection = () => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  const { theme, locale, selectedFiatMoneySymbol } = useSettings();

  const fiatMoneySymbolList = useAppSelector((s) => s.fiatMoney.symbolList);

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
      <Box borderRadius="12" bg="surface-default" shadow="depth.2">
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
              onChange={(l) => dispatch(setLocale(l as 'zh-CN'))}
              options={[
                { label: 'English', value: 'en-US' },
                { label: '简体中文', value: 'zh-CN' },
                { label: '繁體中文', value: 'zh-HK' },
                { label: 'Deutsch', value: 'de' },
                { label: 'Español', value: 'es' },
                // { label: 'Filipino', value: 'fil-PH' },
                { label: 'Français', value: 'fr-FR' },
                { label: '日本語', value: 'ja-JP' },
                { label: '한국어', value: 'ko-KR' },
                { label: 'Pусский', value: 'ru' },
                { label: 'ภาษาไทย', value: 'th-TH' },
                // { label: 'Tiếng Việt', value: 'vi-VN' },
                { label: 'Italiano', value: 'it-IT' },
                { label: 'Монгол', value: 'mn-MN' },
                { label: 'Українська', value: 'uk-UA' },
                { label: 'भाषा', value: 'hi-IN' },
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
          <Box w="full">
            <Select<string>
              title={intl.formatMessage({
                id: 'form__fiat_currency',
                defaultMessage: 'Fiat currency',
              })}
              isTriggerPlain
              footer={null}
              headerShown={false}
              value={selectedFiatMoneySymbol ?? 'usd'}
              onChange={(value) => {
                dispatch(setSelectedFiatMoneySymbol(value));
              }}
              options={fiatMoneySymbolList.map((symbol) => ({
                label: symbol.toUpperCase(),
                value: symbol,
              }))}
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
