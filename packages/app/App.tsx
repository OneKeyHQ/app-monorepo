import 'expo-dev-client';
import React, { FC } from 'react';
import { Provider } from '@onekeyhq/kit';
import useLoadCustomFonts from '@onekeyhq/components/assets/fonts/static-fonts';

const App: FC = function () {
  const fontsLoaded = useLoadCustomFonts();
  if (!fontsLoaded) {
    return null;
  }
  return <Provider />;
};

export default App;
