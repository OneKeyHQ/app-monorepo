import { memo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { XStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Electron drag-region helpers. On desktop, the header container is a window
// drag handle; interactive children opt out so they remain clickable.
const DRAG_STYLE = (platformEnv.isDesktop
  ? { WebkitAppRegion: 'drag' }
  : undefined) as any;

const NO_DRAG_STYLE = (platformEnv.isDesktop
  ? { WebkitAppRegion: 'no-drag' }
  : undefined) as any;

export const LayoutHeader = memo(
  ({ children, style, ...rest }: IXStackProps) => {
    return (
      <XStack
        h={52}
        px="$5"
        alignItems="center"
        $gtMd={{
          px: '$10',
        }}
        {...rest}
        style={[DRAG_STYLE, style]}
      >
        {children}
      </XStack>
    );
  },
);
LayoutHeader.displayName = 'LayoutHeader';
