import { memo, useCallback } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { IconButton, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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

export const LayoutHeaderBack = memo(({ exit }: { exit?: boolean }) => {
  const navigation = useAppNavigation();

  const icon = exit ? 'CrossedLargeOutline' : 'ArrowLeftOutline';

  const handleBack = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  return (
    <IconButton
      size="medium"
      icon={icon}
      variant="tertiary"
      onPress={handleBack}
      zIndex={1}
      style={NO_DRAG_STYLE}
    />
  );
});
LayoutHeaderBack.displayName = 'LayoutHeaderBack';
