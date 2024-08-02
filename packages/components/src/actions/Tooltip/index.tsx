import { useEffect, useMemo, useState } from 'react';

import { Tooltip as TMTooltip } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
import type {
  PopoverContentProps,
  TooltipProps as TMTooltipProps,
} from 'tamagui';

export function TooltipText({
  children,
  onDisplayChange,
}: ISizableTextProps & {
  onDisplayChange?: (isShow: boolean) => void;
}) {
  // Since the browser does not trigger mouse events when the page scrolls,
  //  it is necessary to manually close the tooltip when page elements scroll
  useEffect(() => {
    if (!platformEnv.isNative) {
      let scrolling = false;
      let mouseMoving = false;
      const onScroll = () => {
        if (scrolling) {
          return;
        }
        onDisplayChange?.(false);
        scrolling = true;
      };
      const onScrollEnd = () => {
        scrolling = false;
        onDisplayChange?.(true);
      };
      const onMouseMove = (e: { which: number }) => {
        if (e?.which !== 1) {
          return;
        }
        if (mouseMoving) {
          return;
        }
        onDisplayChange?.(false);
        mouseMoving = true;
      };
      const onMouseUp = () => {
        document.removeEventListener('mouseup', onMouseMove, false);
        requestAnimationFrame(() => {
          onDisplayChange?.(true);
          mouseMoving = false;
        });
      };
      if (typeof document !== 'undefined') {
        document.addEventListener('scroll', onScroll, true);
        document.addEventListener('scrollend', onScroll, true);
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mouseup', onMouseUp, false);
        return () => {
          document.removeEventListener('scroll', onScroll, true);
          document.removeEventListener('scrollend', onScrollEnd, true);
          document.removeEventListener('mousemove', onMouseMove, false);
        };
      }
    }
  }, [onDisplayChange]);
  return <SizableText size="$bodySm">{children}</SizableText>;
}

export interface ITooltipProps extends TMTooltipProps {
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
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
  const [shouldShow, setShouldShow] = useState(true);

  const renderTooltipContent = useMemo(() => {
    if (typeof renderContent === 'string') {
      return (
        <TooltipText onDisplayChange={setShouldShow}>
          {renderContent}
        </TooltipText>
      );
    }

    return renderContent;
  }, [renderContent]);

  const open = useMemo(() => shouldShow && isShow, [shouldShow, isShow]);

  return (
    <TMTooltip
      unstyled
      delay={0}
      offset={6}
      open={open}
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
