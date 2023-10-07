import { useColorScheme } from 'react-native';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config';
import React from 'react';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

export const decorators = [
  (Story) => {
    const colorScheme = useColorScheme();
    return (
      <TamaguiProvider config={config}>
        {/* <Theme name={colorScheme === 'dark' ? 'dark' : 'light'}> */}
        <Story />
        {/* </Theme> */}
      </TamaguiProvider>
    );
  },
];
