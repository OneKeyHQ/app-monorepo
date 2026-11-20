import { type CSSProperties, type ReactNode, useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Popover } from '../../actions/Popover';
import { Tooltip } from '../../actions/Tooltip';
import { useMedia } from '../../hooks/useStyle';
import { SizableText } from '../../primitives/SizeableText';
import { XStack, YStack } from '../../primitives/Stack';
import { useTheme } from '../../shared/tamagui';

import type { IPopoverProps } from '../../actions/Popover';
import type { ITooltipProps } from '../../actions/Tooltip';
import type { ISizableTextProps } from '../../primitives';

export interface IDashTextProps extends ISizableTextProps {
  /**
   * Dash geometry is honored on web only. iOS and Android draw the dashes as
   * a native dashed text decoration, whose pattern the platform sets;
   * `dashThickness` there only sizes the space reserved below the text.
   */
  dashLength?: number;
  dashGap?: number;
  dashColor?: string;
  dashThickness?: number;
  dashSpacing?: number;
  /**
   * Draw the dashes on the text box's bottom edge instead of under it, so the
   * element measures exactly as tall as plain text. Use it wherever the label
   * shares a line with plain ones: in flow the dashes add height, and a
   * centred row then lifts the dashed text above the rest.
   */
  dashOverlay?: boolean;
  /** Draw an underline for each wrapped line instead of the whole text box. */
  multiline?: boolean;
  // Widened from `string` so a formatted value (a price, a percentage) can
  // carry the same dashes as a plain label. Every existing caller passes a
  // string, which is still a ReactNode.
  children: ReactNode;
  length?: number;
  /** When set, wraps with Tooltip on desktop and Popover on mobile */
  tooltip?: string;
  /** Title for the mobile Popover sheet. Defaults to children text. */
  tooltipTitle?: string;
  /** Force tooltip or popover behavior instead of relying on media queries. */
  tooltipDisplayMode?: 'auto' | 'tooltip' | 'popover';
  /** Controls the placement used by the tooltip/popover. */
  tooltipPlacement?: ITooltipProps['placement'];
  /** Opt into tighter tooltip trigger hit testing when needed. */
  tooltipTriggerAsChild?: ITooltipProps['triggerAsChild'];
  /**
   * Keep the desktop tooltip open while the pointer stays over the trigger or
   * the tooltip content, instead of relying on the default flicker-prone
   * open/close behavior.
   */
  tooltipHovering?: boolean;
}

function DashTextCore({
  children,
  dashLength = 3,
  dashGap = 2,
  dashThickness = 0.5,
  dashSpacing = 1,
  dashColor = '$borderStrong',
  dashOverlay = false,
  multiline = false,
  length = 200,
  onTextLayout,
  ...textProps
}: Omit<
  IDashTextProps,
  | 'tooltip'
  | 'tooltipTitle'
  | 'tooltipDisplayMode'
  | 'tooltipPlacement'
  | 'tooltipTriggerAsChild'
>) {
  const theme = useTheme();
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
            ...(multiline ? { maxWidth: '100%' } : undefined),
          },
    [multiline],
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

  const dashColorValue = dashColor.startsWith('$')
    ? theme[dashColor.slice(1) as keyof typeof theme]?.val
    : dashColor;
  const webMultilineStyle = useMemo<CSSProperties>(
    () => ({
      // Each inline fragment gets its own bounded dash pattern when text wraps.
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
      backgroundImage: `repeating-linear-gradient(to right, ${dashColorValue} 0 ${dashLength}px, transparent ${dashLength}px ${dashLength + dashGap}px)`,
      backgroundPosition: 'left bottom',
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${Math.max(0, length * (dashLength + dashGap) - dashGap)}px ${dashThickness}px`,
      paddingBottom: dashOverlay ? 0 : dashSpacing,
    }),
    [
      dashColorValue,
      dashLength,
      dashGap,
      length,
      dashThickness,
      dashOverlay,
      dashSpacing,
    ],
  );

  const overlayProps = dashOverlay
    ? ({ position: 'absolute', bottom: 0, left: 0, right: 0 } as const)
    : undefined;

  if (!platformEnv.isNative) {
    return (
      <YStack alignItems="flex-start" style={webDashWrapperStyle}>
        <SizableText
          {...textProps}
          onTextLayout={onTextLayout}
          paddingBottom={dashOverlay ? 0 : '$0.2'}
          maxWidth={multiline ? '100%' : textProps.maxWidth}
        >
          {multiline && length > 0 ? (
            <span style={webMultilineStyle}>{children}</span>
          ) : (
            children
          )}
        </SizableText>
        {length > 0 && !multiline ? (
          <YStack
            width="100%"
            mt={dashOverlay ? 0 : dashSpacing}
            height={resolvedDashThickness}
            bg={dashColor}
            pointerEvents="none"
            style={webDashLineStyle}
            {...overlayProps}
          />
        ) : null}
      </YStack>
    );
  }

  // React Native draws dashed text decoration on iOS and Android itself, per
  // wrapped line and in the same frame as the glyphs. Measuring the text first
  // and then laying out dash views took a second commit, so the label showed
  // without its dashes for a frame (OK-54207). The platform decides the dash
  // length, gap and thickness; the padding below keeps the box as tall as the
  // view-drawn rule made it, so surrounding layouts do not shift.
  const decorationProps =
    length > 0 && dashThickness > 0
      ? ({
          textDecorationLine: 'underline',
          textDecorationStyle: 'dashed',
          textDecorationColor: dashColor,
        } as const)
      : undefined;
  const reservesDashHeight = !dashOverlay && length > 0;

  if (multiline) {
    return (
      <YStack
        maxWidth="100%"
        paddingBottom={reservesDashHeight ? dashSpacing + dashThickness : 0}
      >
        <SizableText
          {...textProps}
          {...decorationProps}
          onTextLayout={onTextLayout}
        >
          {children}
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack
      alignItems="flex-start"
      paddingBottom={reservesDashHeight ? dashThickness : 0}
    >
      <SizableText
        {...textProps}
        {...decorationProps}
        onTextLayout={onTextLayout}
        paddingBottom={dashOverlay ? 0 : '$0.2'}
      >
        {children}
      </SizableText>
    </YStack>
  );
}

export function DashText({
  tooltip,
  tooltipTitle,
  tooltipDisplayMode = 'auto',
  tooltipPlacement = 'top',
  tooltipTriggerAsChild = 'except-style',
  tooltipHovering,
  ...rest
}: IDashTextProps) {
  const { gtMd } = useMedia();
  let displayMode = tooltipDisplayMode;
  if (displayMode === 'auto') {
    displayMode = gtMd ? 'tooltip' : 'popover';
  }

  const trigger = useMemo(
    () => (tooltip ? <DashTextCore {...rest} cursor="help" /> : null),
    [rest, tooltip],
  );

  // Hovering mode needs a real (non-asChild) trigger element so the Tooltip's
  // onHoverIn/out handlers receive pointer events; wrap the dashed text.
  const hoverTrigger = useMemo(
    () => (
      <XStack cursor="help">
        <DashTextCore {...rest} />
      </XStack>
    ),
    [rest],
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

  if (!platformEnv.isNative && displayMode === 'tooltip') {
    return (
      <Tooltip
        placement={tooltipPlacement as ITooltipProps['placement']}
        // In hovering mode the open state is driven by explicit onHoverIn/out
        // handlers, which never fire when the trigger is cloned via asChild.
        // Wrap the trigger in a Stack and let Tooltip render its own trigger
        // element (no asChild) so the pointer events reach it.
        triggerAsChild={tooltipHovering ? undefined : tooltipTriggerAsChild}
        hovering={tooltipHovering}
        renderContent={tooltip}
        renderTrigger={tooltipHovering ? hoverTrigger : trigger}
      />
    );
  }

  return (
    <Popover
      // The sheet needs a title and a formatted node makes no sense as one,
      // so a non-string child falls back to empty and asks the caller for
      // `tooltipTitle` instead. Node children only appear on desktop, which
      // takes the tooltip branch above and never reaches this.
      title={
        tooltipTitle ?? (typeof rest.children === 'string' ? rest.children : '')
      }
      placement={tooltipPlacement as IPopoverProps['placement']}
      renderTrigger={trigger}
      renderContent={popoverContent}
    />
  );
}
