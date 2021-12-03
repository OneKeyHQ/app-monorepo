import React from 'react';
import { Center, useTheme, Switch, useLocale } from '@onekeyhq/components';

const Settings = () => {
  const { setThemeVariant, themeVariant } = useTheme();
  const { locale, setLocale } = useLocale();

  return (
    <Center flex="1" bg="border-subdued">
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
    </Center>
  );
};

export default Settings;
