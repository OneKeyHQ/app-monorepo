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
    // window: the page header sits above it and can change height on its own.
    // On web a Tamagui element is its DOM node.
    let container = (ref.current as HTMLElement | null)?.parentElement ?? null;
    while (container) {
      const { overflowY } = getComputedStyle(container);
      if (overflowY === 'auto' || overflowY === 'scroll') break;
      container = container.parentElement;
    }
    const scroller = container;
    const measure = () => {
      setHeight(scroller ? scroller.clientHeight : window.innerHeight);
    };
    measure();
    if (scroller && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(scroller);
      return () => observer.disconnect();
    }
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
      {/* Rows bleed 12px, so a 12px gutter puts their text 24px in. The top
          follows the page's desktop top padding, keeping the first label
          level with the device. */}
      <YStack px={12} pt={40} pb="$10">
        <DeviceHelpPanel />
      </YStack>
    </YStack>
  );
}
