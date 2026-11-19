import { YStack } from '@onekeyhq/components';

import { DeviceHelpPanel } from './DeviceHelpPanel';

const DEVICE_HELP_SIDEBAR_WIDTH = 368;

// Help in its own pane at the page's right edge, as tall as the page. It
// scrolls on its own, and scrolling over it never moves the settings.
export function DeviceHelpSidebar() {
  return (
    <YStack
      w={DEVICE_HELP_SIDEBAR_WIDTH}
      flexShrink={0}
      borderLeftWidth={1}
      borderLeftColor="$neutral4"
      style={{ overflowY: 'auto', overscrollBehavior: 'contain' }}
    >
      {/* Rows bleed 12px, so a 12px gutter puts their text 24px in. The top
          follows the page's desktop top padding, keeping the first label
          level with the device. */}
      <YStack px={12} pt={40} pb="$10">
        <DeviceHelpPanel />
      </YStack>
    </YStack>
  );
}
