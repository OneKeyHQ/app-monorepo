/* eslint-disable global-require */
import type { PropsWithChildren } from 'react';

import { Splash } from '@onekeyhq/components';

export function SplashProvider({ children }: PropsWithChildren<unknown>) {
  return <Splash>{children}</Splash>;
}
