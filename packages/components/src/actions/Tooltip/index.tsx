import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Tooltip as TMTooltip } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
import type { ScrollView } from 'react-native';
import type { TooltipProps as TMTooltipProps } from 'tamagui';

export function TooltipText({
  children,
  scrollViewRef,
  onDisplayChange,
}: ISizableTextProps & {
  scrollViewRef?: RefObject<ScrollView>;
  onDisplayChange: (isShow: boolean) => void;
}) {
  useEffect(() => {
    if (!platformEnv.isNative) {
      let scrolling = false;
      const onScroll = () => {
        if (scrolling) {
          return;
        }
        onDisplayChange(false);
        scrolling = true;
      };
      const onScrollEnd = () => {
        scrolling = false;
        onDisplayChange(true);
      };
      const scrollView = scrollViewRef?.current as unknown as HTMLElement;
      if (scrollView) {
        scrollView?.addEventListener('scroll', onScroll);
        scrollView?.addEventListener('scrollend', onScrollEnd);
      }
      return () => {
        scrollView?.removeEventListener('scroll', onScroll);
        scrollView?.removeEventListener('scrollend', onScrollEnd);
      };
    }
  }, [onDisplayChange, scrollViewRef]);
  return <SizableText size="$bodySm">{children}</SizableText>;
}

export interface ITooltipProps extends TMTooltipProps {
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
  scrollViewRef?: RefObject<ScrollView>;
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
  scrollViewRef,
  placement = 'bottom',
  ...props
}: ITooltipProps) {
  const transformOrigin = transformOriginMap[placement] || 'bottom center';

  const [isShow, setIsShow] = useState(true);

  const handleDisplayChange = useCallback((isShowValue: boolean) => {
    setIsShow(isShowValue);
  }, []);

  // Browser don't fire mouse events when the page scrolls.

  const renderTooltipContent = useMemo(() => {
    if (typeof renderContent === 'string') {
      return (
        <TooltipText
          scrollViewRef={scrollViewRef}
          onDisplayChange={handleDisplayChange}
        >
          {renderContent}
        </TooltipText>
      );
    }

    return renderContent;
  }, [handleDisplayChange, renderContent, scrollViewRef]);

  return (
    <TMTooltip
      unstyled
      delay={0}
      offset={6}
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
        style={{
          transformOrigin,
          display: isShow ? undefined : 'none',
        }}
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
