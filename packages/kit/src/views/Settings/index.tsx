import React from 'react';
import { Box, useTheme, Switch, useLocale } from '@onekeyhq/components';
import DemoInpageProvider from '@onekeyhq/inpage-provider/src/demo/DemoInpageProvider';

const Settings = () => {
  const { setThemeVariant, themeVariant } = useTheme();
  const { locale, setLocale } = useLocale();

  return (
    <Box flex="1" bg="background-hovered">
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
      <DemoInpageProvider fullDemo />
    </Box>
  );
};

export default Settings;
