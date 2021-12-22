import React from 'react';

import { Box, Button, Switch, useLocale, useTheme } from '@onekeyhq/components';

import WebView from '../../components/WebView';
import useNavigation from '../../hooks/useNavigation';

const Settings = () => {
  const navigation = useNavigation();
  const { setThemeVariant, themeVariant } = useTheme();
  const { locale, setLocale } = useLocale();

  return (
    <Box flex="1" bg="background-hovered">
      <Button
        onPress={() => {
          navigation.navigate('Approval');
        }}
      >
        Send Transaction
      </Button>
      <Switch
        isChecked={themeVariant === 'light'}
        onToggle={() =>
          setThemeVariant(themeVariant === 'light' ? 'dark' : 'light')
        }
      />
      <Switch
        isChecked={locale === 'zh-CN'}
        onToggle={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
      />
      <WebView
        src="https://app.uniswap.org/#/swap"
        showWalletActions
        showDemoActions
      />
    </Box>
  );
};

export default Settings;
