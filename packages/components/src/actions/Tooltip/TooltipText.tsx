import { useEffect, useMemo, useRef } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EShortcutEvents,
  shortcutsMap,
} from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { SizableText, XStack } from '../../primitives';
import { Shortcut } from '../Shortcut';

import type { ISizableTextProps } from '../../primitives';

export function TooltipText({
  children,
  onDisplayChange,
  onDisabledChange,
  shortcutKey,
}: ISizableTextProps & {
  shortcutKey?: EShortcutEvents | string[];
  onDisplayChange?: (isShow: boolean) => void;
  onDisabledChange?: (isShow: boolean) => void;
}) {
  const shortcutsKeys = useMemo(() => {
    if (platformEnv.isDesktop && shortcutKey) {
      return Array.isArray(shortcutKey)
        ? shortcutKey
        : shortcutsMap[shortcutKey].keys;
    }
    return [];
  }, [shortcutKey]);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Since the browser does not trigger mouse events when the page scrolls,
  // it is necessary to manually close the tooltip when page elements scroll.
  useEffect(() => {
    let scrolling = false;
    const onScroll = () => {
      if (scrolling) {
        return;
      }
      onDisplayChange?.(false);
      scrolling = true;
      scrollTimeoutRef.current = setTimeout(() => {
        scrolling = false;
      }, 30);
    };
    const onScrollEnd = () => {
      clearTimeout(scrollTimeoutRef.current);
      scrolling = false;
      document.removeEventListener('scrollend', onScrollEnd, true);
    };
    const onDragEnd = () => {
      appEventBus.off(EAppEventBusNames.onDragEndInListView, onDragEnd);
      void timerUtils.setTimeoutPromised(() => {
        onDisabledChange?.(false);
      });
    };
    const onDragBegin = () => {
      appEventBus.on(EAppEventBusNames.onDragEndInListView, onDragEnd);
      onDisabledChange?.(true);
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('scroll', onScroll, true);
      document.addEventListener('scrollend', onScrollEnd, true);
      appEventBus.on(EAppEventBusNames.onDragBeginInListView, onDragBegin);
      return () => {
        document.removeEventListener('scroll', onScroll, true);
        appEventBus.off(EAppEventBusNames.onDragBeginInListView, onDragBegin);
      };
    }
    return undefined;
  }, [onDisabledChange, onDisplayChange]);
  return (
    <XStack ai="center">
      <SizableText size="$bodySm">{children}</SizableText>
      {platformEnv.isDesktop && shortcutsKeys.length ? (
        <Shortcut pl="$2">
          {shortcutsKeys.map((key) => (
            <Shortcut.Key key={key}>{key}</Shortcut.Key>
          ))}
        </Shortcut>
      ) : null}
    </XStack>
  );
}
