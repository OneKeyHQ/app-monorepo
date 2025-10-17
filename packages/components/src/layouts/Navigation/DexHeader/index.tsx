import type { ReactNode } from 'react';
import { useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { XStack } from '../../../primitives';
import HeaderButtonGroup from '../Header/HeaderButtonGroup';

export interface IDexHeaderProps {
  children?: ReactNode;
  leftContent?: ReactNode;
}

export function DexHeader({ children, leftContent }: IDexHeaderProps = {}) {
  const width = useMemo(() => {
    if (platformEnv.isNative) {
      return undefined;
    }
    if (platformEnv.isDesktopMac) {
      return 'unset';
    }
    return '100%';
  }, []);

  return (
    <XStack
      testID="Dex-Header"
      className="app-region-no-drag"
      width={width}
      jc="space-between"
      ai="center"
      px="$4"
      py="$2"
    >
      {leftContent ? (
        <XStack flex={1} ai="center">
          {leftContent}
        </XStack>
      ) : null}
      <HeaderButtonGroup jc={platformEnv.isNative ? undefined : 'flex-end'}>
        {children}
      </HeaderButtonGroup>
    </XStack>
  );
}

export default DexHeader;
