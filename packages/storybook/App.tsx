import type { ReactNode } from 'react';

import { useColorScheme } from 'react-native';
import { TamaguiProvider, Theme } from 'tamagui';

import config from './tamagui.config';

const Wrapper = ({ children }: { children: ReactNode }) => {
  const colorScheme = useColorScheme();

  return (
    <TamaguiProvider config={config}>
      <Theme name={colorScheme === 'dark' ? 'dark' : 'light'}>{children}</Theme>
    </TamaguiProvider>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const StorybookUI = require('./.ondevice').default;

const AppEntryPoint = () => (
  <Wrapper>
    <StorybookUI />
  </Wrapper>
);

export default AppEntryPoint;
