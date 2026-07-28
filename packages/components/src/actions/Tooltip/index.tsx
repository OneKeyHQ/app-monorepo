import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { TMTooltip } from '@onekeyhq/components/src/shared/tamaguiOverlay';
import type { PopoverContentProps } from '@onekeyhq/components/src/shared/tamaguiOverlay';

import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '../../utils/animationConstants';

import { TooltipContext } from './context';
import { TooltipText } from './TooltipText';

import type { ITooltipProps } from './type';

const tooltipEnterStyle = { scale: 0.95, opacity: 0 } as const;
const tooltipExitStyle = { scale: 0.95, opacity: 0 } as const;

const useHoverTooltip = () => {
  const [isHovered, setIsHovered] = useState(false);
  const showTooltipRef = useRef(isHovered);
  showTooltipRef.current = isHovered;
  const closeTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHoverIn = useCallback(() => {
    if (showTooltipRef.current) {
      if (closeTooltipTimer.current) {
        clearTimeout(closeTooltipTimer.current);
      }
    } else {
      showTooltipTimer.current = setTimeout(() => {
        setIsHovered(true);
      }, 250);
    }
  }, []);
  const dismissTooltip = useCallback(() => {
    setIsHovered(false);
  }, []);
  const handleHoverOut = useCallback(() => {
    if (showTooltipRef.current) {
      closeTooltipTimer.current = setTimeout(() => {
        dismissTooltip();
      }, 300);
    } else if (showTooltipTimer.current) {
      clearTimeout(showTooltipTimer.current);
    }
  }, [dismissTooltip]);
  return {
    setIsHovered,
    isHovered,
    onContentHoverIn: handleHoverIn,
    onContentHoverOut: handleHoverOut,
  };
};

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

  const [isShow, setIsShow] = useState(false);
  const [forceClose, setForceClose] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  const { isHovered, setIsHovered, onContentHoverIn, onContentHoverOut } =
    useHoverTooltip();

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

  const isOpen = useMemo(() => {
    if (forceClose) {
      return false;
    }
    if (hovering) {
      return isHovered;
    }
    return isDisabled ? false : isShow;
  }, [forceClose, hovering, isDisabled, isShow, isHovered]);

  const handleHoverIn = useCallback(() => {
    if (hovering) {
      onContentHoverIn();
    }
  }, [hovering, onContentHoverIn]);

  const handleHoverOut = useCallback(() => {
    if (hovering) {
      onContentHoverOut();
    }
  }, [hovering, onContentHoverOut]);

  const closeTooltip = useCallback(() => {
    return new Promise<void>((resolve) => {
      setForceClose(true);
      setIsShow(false);
      setIsHovered(false);
      setTimeout(() => {
        resolve();
      }, 150);
      setTimeout(() => {
        setForceClose(false);
      }, 200);
    });
  }, [setIsHovered, setIsShow, setForceClose]);

  useImperativeHandle(
    ref,
    () => ({
      closeTooltip,
      openTooltip: () => {
        return new Promise<void>((resolve) => {
          setIsShow(true);
          setIsHovered(true);
          setTimeout(() => {
            resolve();
          }, 50);
        });
      },
    }),
    [closeTooltip, setIsHovered],
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
        onOpenChange={setIsShow}
        allowFlip
        placement={placement}
        {...props}
      >
        <TMTooltip.Trigger
          asChild={triggerAsChild}
          disabled={disabled}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
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
          {...contentProps}
          elevation={10}
          style={contentStyle}
          enterStyle={tooltipEnterStyle}
          exitStyle={tooltipExitStyle}
          animation="quick"
          animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
        >
          {renderTooltipContent}
        </TMTooltip.Content>
      </TMTooltip>
    </TooltipContext.Provider>
  );
}

Tooltip.Text = TooltipText;

export * from './context';
export * from './type';
