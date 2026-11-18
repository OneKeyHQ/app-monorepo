import { useLayoutEffect, useRef, useState } from 'react';

import { YStack } from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';

import { DeviceHelpPanel } from './DeviceHelpPanel';

const DEVICE_HELP_SIDEBAR_WIDTH = 368;

// Help pinned to the page's right edge at full height. It stays put while the
// settings scroll, and scrolls on its own if it ever outgrows the window.
export function DeviceHelpSidebar() {
  const ref = useRef<IElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    // Sticky positioning needs the height of the scrolling page, not the
    // window: the page header sits above it.
    const measure = () => {
      // On web a Tamagui element is its DOM node.
      let node = (ref.current as HTMLElement | null)?.parentElement ?? null;
      while (node) {
        const { overflowY } = getComputedStyle(node);
        if (overflowY === 'auto' || overflowY === 'scroll') break;
        node = node.parentElement;
      }
      setHeight(node ? node.clientHeight : window.innerHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return (
    <YStack
      ref={ref}
      w={DEVICE_HELP_SIDEBAR_WIDTH}
      flexShrink={0}
      borderLeftWidth={1}
      borderLeftColor="$neutral4"
      style={{ position: 'sticky', top: 0, height, overflowY: 'auto' }}
    >
      {/* Rows bleed 12px, so a 12px gutter puts their text 24px in. */}
      <YStack px={12} pt={24} pb="$6">
        <DeviceHelpPanel />
      </YStack>
    </YStack>
  );
}
