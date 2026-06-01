import { type CSSProperties, useCallback, useMemo, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Popover } from '../../actions/Popover';
import { Tooltip } from '../../actions/Tooltip';
import { useMedia } from '../../hooks/useStyle';
import { SizableText } from '../../primitives/SizeableText';
import { XStack, YStack } from '../../primitives/Stack';

import type { ISizableTextProps } from '../../primitives';
import type { LayoutChangeEvent } from 'react-native';

export interface IDashTextProps extends ISizableTextProps {
  dashLength?: number;
  dashGap?: number;
  dashColor?: string;
  dashThickness?: number;
  dashSpacing?: number;
  children: string;
  length?: number;
  /** When set, wraps with Tooltip on desktop and Popover on mobile */
  tooltip?: string;
  /** Title for the mobile Popover sheet. Defaults to children text. */
  tooltipTitle?: string;
}

function DashTextCore({
  children,
  dashLength = 3,
  dashGap = 2,
  dashThickness = 0.5,
  dashSpacing = 1,
  dashColor = '$borderStrong',
  length = 200,
  ...textProps
}: Omit<IDashTextProps, 'tooltip' | 'tooltipTitle'>) {
  const [textWidth, setTextWidth] = useState(0);
  const resolvedDashThickness = platformEnv.isNative
    ? dashThickness
    : Math.max(1, dashThickness);
  const webDashScaleY = platformEnv.isNative
    ? 1
    : Math.max(0, Math.min(1, dashThickness));
  const webDashWrapperStyle = useMemo<CSSProperties | undefined>(
    () =>
      platformEnv.isNative
        ? undefined
        : {
            display: 'inline-flex',
            width: 'fit-content',
          },
    [],
  );
  const webDashLineStyle = useMemo<CSSProperties | undefined>(
    () =>
      platformEnv.isNative
        ? undefined
        : {
            WebkitMaskImage: `repeating-linear-gradient(to right, #000 0 ${dashLength}px, #000 ${dashLength}px, transparent ${dashLength}px, transparent ${
              dashLength + dashGap
            }px)`,
            WebkitMaskPosition: 'left bottom',
            WebkitMaskRepeat: 'repeat-x',
            WebkitMaskSize: `${
              dashLength + dashGap
            }px ${resolvedDashThickness}px`,
            maskImage: `repeating-linear-gradient(to right, #000 0 ${dashLength}px, #000 ${dashLength}px, transparent ${dashLength}px, transparent ${
              dashLength + dashGap
            }px)`,
            maskPosition: 'left bottom',
            maskRepeat: 'repeat-x',
            maskSize: `${dashLength + dashGap}px ${resolvedDashThickness}px`,
            transform: `translateZ(0) scaleY(${webDashScaleY})`,
            transformOrigin: 'top left',
          },
    [dashGap, dashLength, resolvedDashThickness, webDashScaleY],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  }, []);

  if (!platformEnv.isNative) {
    return (
      <YStack alignItems="flex-start" style={webDashWrapperStyle}>
        <SizableText {...textProps} paddingBottom="$0.2">
          {children}
        </SizableText>
        {length > 0 ? (
          <YStack
            width="100%"
            mt={dashSpacing}
            height={resolvedDashThickness}
            bg={dashColor}
            pointerEvents="none"
            style={webDashLineStyle}
          />
        ) : null}
      </YStack>
    );
  }

  return (
    <YStack alignItems="flex-start">
      <YStack onLayout={handleLayout}>
        <SizableText {...textProps} paddingBottom="$0.2">
          {children}
        </SizableText>
      </YStack>
      {length > 0 ? (
        <XStack
          gap={dashGap}
          height={dashThickness}
          overflow="hidden"
          flexWrap="nowrap"
          width={textWidth || 0}
        >
          {textWidth > 0
            ? Array.from({ length }, (_, i) => (
                <YStack
                  key={i}
                  width={dashLength}
                  height={resolvedDashThickness}
                  bg={dashColor}
                  flexShrink={0}
                />
              ))
            : null}
        </XStack>
      ) : null}
    </YStack>
  );
}

export function DashText({ tooltip, tooltipTitle, ...rest }: IDashTextProps) {
  const { gtMd } = useMedia();

  const trigger = useMemo(
    () => (tooltip ? <DashTextCore {...rest} cursor="help" /> : null),
    [rest, tooltip],
  );

  const popoverContent = useMemo(
    () => (
      <YStack px="$5" pt="$2" pb="$5">
        <SizableText size="$bodyMd" color="$textSubdued">
          {tooltip}
        </SizableText>
      </YStack>
    ),
    [tooltip],
  );

  if (!tooltip) {
    return <DashTextCore {...rest} />;
  }

  if (gtMd) {
    return (
      <Tooltip
        placement="top"
        renderContent={tooltip}
        renderTrigger={trigger}
      />
    );
  }

  return (
    <Popover
      title={tooltipTitle ?? rest.children}
      renderTrigger={trigger}
      renderContent={popoverContent}
    />
  );
}
