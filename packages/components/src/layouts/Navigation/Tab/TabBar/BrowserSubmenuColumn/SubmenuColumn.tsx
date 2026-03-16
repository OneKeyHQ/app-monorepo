import type { ReactElement } from 'react';

import { Stack, XStack, YStack } from '@onekeyhq/components/src/primitives';
import { MIN_SIDEBAR_WIDTH } from '@onekeyhq/components/src/utils/sidebar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Height to align with primary menu header (Mac drag area or logo area)
const HEADER_ALIGNMENT_HEIGHT = 52;
export const EXPANDED_SUBMENU_WIDTH = 208;
const COLLAPSED_SUBMENU_WIDTH = MIN_SIDEBAR_WIDTH - 10;

export interface ISubmenuColumnProps {
  webPageTabBar: ReactElement;
  isExpanded?: boolean;
}

export function SubmenuColumn({
  webPageTabBar,
  isExpanded = false,
}: ISubmenuColumnProps) {
  return (
    <Stack width={COLLAPSED_SUBMENU_WIDTH} flex={1}>
      {/* Desktop drag area - always bgSidebar, not affected by expand */}
      {platformEnv.isDesktopWithCustomTitleBar ? (
        <XStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          h={HEADER_ALIGNMENT_HEIGHT}
          zIndex={11}
          style={{
            // @ts-expect-error - Electron drag region
            WebkitAppRegion: 'drag',
          }}
        />
      ) : null}
      {/* Content area that expands on hover */}
      <YStack
        position="absolute"
        top={platformEnv.isDesktop ? HEADER_ALIGNMENT_HEIGHT : 0}
        left={0}
        bottom={0}
        width={isExpanded ? EXPANDED_SUBMENU_WIDTH : COLLAPSED_SUBMENU_WIDTH}
        bg={isExpanded ? '$bgApp' : '$bgSidebar'}
        pt={8}
        px="$3"
        zIndex={10}
        animation="quick"
        borderTopRightRadius={isExpanded ? '$3' : 0}
        borderBottomRightRadius={isExpanded ? '$3' : 0}
        borderTopWidth={1}
        borderBottomWidth={1}
        borderRightWidth={1}
        borderColor={isExpanded ? '$neutral3' : 'transparent'}
        style={{
          boxShadow: isExpanded
            ? '10px 0 30px -10px rgba(0, 0, 0, 0.10)'
            : 'none',
        }}
      >
        {webPageTabBar}
      </YStack>
    </Stack>
  );
}
