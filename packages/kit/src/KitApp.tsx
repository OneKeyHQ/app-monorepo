import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { KitProvider } from './provider';

function KitApp({ ...props }) {
  // const locale = useCurrentLocale();
  const locale = 'en';

  return (
    <NavigationContainer>
      <KitProvider language={locale} {...props} />
    </NavigationContainer>
  );
}

export default KitApp;
