import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  OverlayView,
  useNestedOverlayLevel,
} from '@onekeyfe/react-native-native-overlay';

import { Stack, YStack } from '../../primitives';
import {
  useAnchoredPosition,
  useOutsidePress,
} from '../Popover/anchoredPopover';

import { TooltipContext } from './context';
import { TooltipText } from './TooltipText';
import { useTooltipOpenState } from './useTooltipOpenState';

import type { ITooltipProps } from './type';
import type { View } from 'react-native';

const TOOLTIP_OFFSET = 6;
const TOOLTIP_CONTENT_WEB_STYLE = {
  width: 'max-content',
  boxShadow:
    '0 4px 6px -4px rgba(0, 0, 0, 0.10), 0 10px 15px -3px rgba(0, 0, 0, 0.10)',
} as const;
// The positioned box Floating UI moves.
const ANCHORED_TOOLTIP_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  display: 'flex',
  flexDirection: 'column',
} as const;

// Web: an anchored, non-blocking native-overlay panel at the `modal` level, or
// the level of the overlay the trigger lives in.
export function Tooltip({
  renderTrigger,
  renderContent,
  placement = 'bottom',
  shortcutKey,
  hovering,
  closeOnScroll,
  contentProps,
  triggerAsChild,
  disabled,
  onPress,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  ref,
}: ITooltipProps) {
  const {
    isOpen: isOpenState,
    setIsShow,
    setIsDisabled,
    handleOpenChange,
    handleTriggerPointerDown,
    handleTriggerMouseEnter,
    handleTriggerMouseLeave,
    handleContentMouseEnter,
    handleContentMouseLeave,
    closeTooltip,
    openTooltip,
  } = useTooltipOpenState({ hovering, closeOnScroll });

  // A controlled `open` wins, and `onOpenChange` then receives the requests.
  const isOpen = openProp ?? isOpenState;
  const requestOpenChange = onOpenChangeProp ?? handleOpenChange;
  const requestOpenChangeRef = useRef(requestOpenChange);
  requestOpenChangeRef.current = requestOpenChange;

  const level = useNestedOverlayLevel();
  const triggerRef = useRef<View | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const handlePanelRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanel(node);
  }, []);

  const reposition = useAnchoredPosition({
    open: isOpen,
    triggerRef,
    panel,
    placement,
    offset: TOOLTIP_OFFSET,
    allowFlip: true,
  });

  const dismiss = useCallback(() => {
    requestOpenChangeRef.current(false);
    void closeTooltip();
  }, [closeTooltip]);

  useOutsidePress({
    enabled: isOpen,
    panelRef,
    triggerRef,
    onOutsidePress: dismiss,
  });

  // Trigger interactions, bound on the DOM node so `triggerAsChild` keeps the
  // caller's element as the trigger.
  const handlersRef = useRef({
    hovering,
    isOpen,
    handleTriggerPointerDown,
    handleTriggerMouseEnter,
    handleTriggerMouseLeave,
  });
  handlersRef.current = {
    hovering,
    isOpen,
    handleTriggerPointerDown,
    handleTriggerMouseEnter,
    handleTriggerMouseLeave,
  };
  useEffect(() => {
    const trigger = triggerRef.current as unknown as HTMLElement | null;
    if (!trigger?.addEventListener) {
      return;
    }
    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        return;
      }
      handlersRef.current.handleTriggerMouseEnter();
      if (!handlersRef.current.hovering) {
        requestOpenChangeRef.current(true);
      }
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        return;
      }
      handlersRef.current.handleTriggerMouseLeave();
      if (!handlersRef.current.hovering) {
        requestOpenChangeRef.current(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      handlersRef.current.handleTriggerPointerDown(event);
      // Touch has no hover: a tap toggles the tooltip.
      if (event.pointerType === 'touch') {
        requestOpenChangeRef.current(!handlersRef.current.isOpen);
      }
    };
    // Keyboard focus only; a pointer press focuses the trigger too.
    const onFocusIn = () => {
      if (trigger.matches(':focus-visible, :has(:focus-visible)')) {
        requestOpenChangeRef.current(true);
      }
    };
    const onFocusOut = () => requestOpenChangeRef.current(false);
    trigger.addEventListener('pointerenter', onPointerEnter);
    trigger.addEventListener('pointerleave', onPointerLeave);
    trigger.addEventListener('pointerdown', onPointerDown);
    trigger.addEventListener('focusin', onFocusIn);
    trigger.addEventListener('focusout', onFocusOut);
    return () => {
      trigger.removeEventListener('pointerenter', onPointerEnter);
      trigger.removeEventListener('pointerleave', onPointerLeave);
      trigger.removeEventListener('pointerdown', onPointerDown);
      trigger.removeEventListener('focusin', onFocusIn);
      trigger.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // Interactive (`hovering`) tooltips stay open while the pointer is over the
  // content; the others let the pointer pass through.
  useEffect(() => {
    if (!panel || !hovering) {
      return;
    }
    panel.addEventListener('mouseenter', handleContentMouseEnter);
    panel.addEventListener('mouseleave', handleContentMouseLeave);
    return () => {
      panel.removeEventListener('mouseenter', handleContentMouseEnter);
      panel.removeEventListener('mouseleave', handleContentMouseLeave);
    };
  }, [handleContentMouseEnter, handleContentMouseLeave, hovering, panel]);

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
  }, [renderContent, setIsDisabled, setIsShow, shortcutKey]);

  useImperativeHandle(
    ref,
    () => ({
      closeTooltip,
      openTooltip,
    }),
    [closeTooltip, openTooltip],
  );

  const contextValue = useMemo(
    () => ({
      closeTooltip,
    }),
    [closeTooltip],
  );

  const panelStyle = useMemo(
    () => ({
      ...ANCHORED_TOOLTIP_STYLE,
      pointerEvents: hovering ? ('auto' as const) : ('none' as const),
    }),
    [hovering],
  );

  return (
    <TooltipContext.Provider value={contextValue}>
      <Stack
        ref={triggerRef}
        asChild={triggerAsChild}
        disabled={disabled}
        onPress={onPress}
      >
        {renderTrigger}
      </Stack>
      <OverlayView
        visible={isOpen}
        level={level}
        presentation="anchored"
        blocking={false}
        backdrop={false}
        onRequestDismiss={dismiss}
        onPresented={reposition}
      >
        <div ref={handlePanelRef} style={panelStyle} role="tooltip">
          <YStack
            maxWidth="$72"
            bg="$bg"
            borderRadius="$2"
            py="$2"
            px="$3"
            outlineWidth="$px"
            outlineStyle="solid"
            outlineColor="$neutral3"
            style={TOOLTIP_CONTENT_WEB_STYLE}
            {...contentProps}
          >
            {renderTooltipContent}
          </YStack>
        </div>
      </OverlayView>
    </TooltipContext.Provider>
  );
}

Tooltip.Text = TooltipText;

export * from './context';
export { closeAllTooltips } from './tooltipRegistry';
export * from './type';
