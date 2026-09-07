import { useImperativeHandle, useMemo } from 'react';

import { TMTooltip } from '@onekeyhq/components/src/shared/tamaguiOverlay';
import type { PopoverContentProps } from '@onekeyhq/components/src/shared/tamaguiOverlay';

import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '../../utils/animationConstants';

import { TooltipContext } from './context';
import { TooltipText } from './TooltipText';
import { useTooltipOpenState } from './useTooltipOpenState';

import type { ITooltipProps } from './type';

const tooltipEnterStyle = { scale: 0.95, opacity: 0 } as const;
const tooltipExitStyle = { scale: 0.95, opacity: 0 } as const;
const tooltipContentWebStyle = { width: 'max-content' } as const;

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
  hovering,
  contentProps,
  triggerAsChild,
  disabled,
  onPress,
  ref,
  ...props
}: ITooltipProps) {
  const transformOrigin = transformOriginMap[placement] || 'bottom center';
  const contentStyle = useMemo(
    () =>
      ({
        transformOrigin,
      }) as PopoverContentProps['style'],
    [transformOrigin],
  );

  const {
    isOpen,
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
  } = useTooltipOpenState({ hovering });

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
  return (
    <TooltipContext.Provider value={contextValue}>
      <TMTooltip
        ref={ref}
        unstyled
        disableAutoCloseOnScroll
        delay={0}
        offset={6}
        open={isOpen}
        onOpenChange={handleOpenChange}
        allowFlip
        placement={placement}
        {...props}
      >
        {/* Tamagui 2 only attaches Web hover listeners when mouse handlers are
            present. Use them on both surfaces so interactive tooltips stay open. */}
        <TMTooltip.Trigger
          asChild={triggerAsChild}
          disabled={disabled}
          onMouseEnter={handleTriggerMouseEnter}
          onMouseLeave={handleTriggerMouseLeave}
          // Pressing the trigger (mouse/pen) closes the tooltip so it never
          // lingers above whatever the press opens. pointerdown is used instead
          // of onPressIn because the latter also fires for touch, where a tap is
          // the only way to reveal a tooltip.
          onPointerDown={handleTriggerPointerDown}
          onPress={onPress}
        >
          {renderTrigger}
        </TMTooltip.Trigger>
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
          $platform-web={tooltipContentWebStyle}
          {...contentProps}
          elevation={10}
          style={contentStyle}
          enterStyle={tooltipEnterStyle}
          exitStyle={tooltipExitStyle}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          onMouseEnter={handleContentMouseEnter}
          onMouseLeave={handleContentMouseLeave}
        >
          {renderTooltipContent}
        </TMTooltip.Content>
      </TMTooltip>
    </TooltipContext.Provider>
  );
}

Tooltip.Text = TooltipText;

export * from './context';
export { closeAllTooltips } from './tooltipRegistry';
export * from './type';
