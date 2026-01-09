import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const LazyHeaderTitle = platformEnv.isNativeIOS
  ? ({ children }: PropsWithChildren) => {
      const [visible, changeVisibleStatus] = useState(false);
      useEffect(() => {
        setTimeout(() => {
          requestIdleCallback(() => {
            changeVisibleStatus(true);
          });
        }, 380);
      }, []);
      return visible ? children : null;
    }
  : ({ children }: PropsWithChildren) => children;
