import { useEffect, useMemo, useRef, useState } from 'react';

import { InteractionManager } from 'react-native';
import { Tooltip as TMTooltip } from 'tamagui';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EShortcutEvents,
  shortcutsMap,
} from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { SizableText, XStack } from '../../primitives';
import { Shortcut } from '../Shortcut';

import type { ITooltipProps } from './type';
import type { ISizableTextProps } from '../../primitives';
import type { PopoverContentProps } from 'tamagui';

export function TooltipText({
  children,
  onDisplayChange,
  onDisabledChange,
  shortcutKey,
}: ISizableTextProps & {
  shortcutKey?: EShortcutEvents;
  onDisplayChange?: (isShow: boolean) => void;
  onDisabledChange?: (isShow: boolean) => void;
}) {
  const shortcutsKeys = useMemo(
    () =>
      platformEnv.isDesktop && shortcutKey
        ? shortcutsMap[shortcutKey].keys
        : [],
    [shortcutKey],
  );
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  // Since the browser does not trigger mouse events when the page scrolls,
  //  it is necessary to manually close the tooltip when page elements scroll
  useEffect(() => {
    let scrolling = false;
    // let mouseMoving = false;
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
      void InteractionManager.runAfterInteractions(() => {
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

const transformOriginMap: Record<
  NonNullable<ITooltipProps['placement']>,
  string
> = {
  'top': 'bottom center',
  'bottom': 'top center',
  'left': 'right center',
  'right': 'left center',
  'top-start': 'bottom left',
  'top-end': 'bottom right',
  'right-start': 'top left',
  'right-end': 'bottom left',
  'bottom-start': 'top left',
  'bottom-end': 'top left',
  'left-start': 'top right',
  'left-end': 'bottom right',
};

export function Tooltip({
  renderTrigger,
  renderContent,
  placement = 'bottom',
  shortcutKey,
  ...props
}: ITooltipProps) {
  const transformOrigin = transformOriginMap[placement] || 'bottom center';

  const contentStyle = useMemo(
    () =>
      ({
        transformOrigin,
      } as PopoverContentProps['style']),
    [transformOrigin],
  );

  const [isShow, setIsShow] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  const renderTooltipContent = useMemo(() => {
    if (typeof renderContent === 'string') {
      return (
        <TooltipText
          shortcutKey={shortcutKey}
          onDisplayChange={setIsShow}
          onDisabledChange={setIsDisabled}
        >
          {renderContent}
        </TooltipText>
      );
    }

    return renderContent;
  }, [renderContent, shortcutKey]);

  return (
    <TMTooltip
      unstyled
      disableAutoCloseOnScroll
      delay={0}
      offset={6}
      open={isDisabled ? false : isShow}
      onOpenChange={setIsShow}
      allowFlip
      placement={placement}
      {...props}
    >
      <TMTooltip.Trigger>{renderTrigger}</TMTooltip.Trigger>
      <TMTooltip.Content
        unstyled
        maxWidth="$72"
        bg="$bg"
        borderRadius="$2"
        py="$2"
        px="$3"
        outlineWidth="$px"
        outlineStyle="solid"
        outlineColor="$neutral3"
        elevation={10}
        style={contentStyle}
        enterStyle={{
          scale: 0.95,
          opacity: 0,
        }}
        exitStyle={{ scale: 0.95, opacity: 0 }}
        animation="quick"
      >
        {renderTooltipContent}
      </TMTooltip.Content>
    </TMTooltip>
  );
}

Tooltip.Text = TooltipText;

export * from './type';
