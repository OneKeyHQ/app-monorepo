import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { normalizeStyle } from '@tamagui/web';
import { I18nManager, StyleSheet, processColor } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Popover } from '../../actions/Popover';
import { Tooltip } from '../../actions/Tooltip';
import { useMedia } from '../../hooks/useStyle';
import { SizableText, StyledSizableText } from '../../primitives/SizeableText';
import { XStack, YStack } from '../../primitives/Stack';
import { useStyle, useTheme } from '../../shared/tamagui';

import type { IPopoverProps } from '../../actions/Popover';
import type { ITooltipProps } from '../../actions/Tooltip';
import type { ISizableTextProps } from '../../primitives';
import type {
  LayoutChangeEvent,
  LayoutRectangle,
  StyleProp,
  TextStyle,
} from 'react-native';

export interface IDashTextProps extends ISizableTextProps {
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
  /**
   * Plain text laid out in the same paragraph before `children`, which keeps
   * its dashes, e.g. a sentence ending in a dashed link. Implies `multiline`.
   */
  leadingText?: ReactNode;
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

type ITextLine = { x: number; y: number; width: number; height: number };

const DEFAULT_DASH_LENGTH = 3;
const DEFAULT_DASH_GAP = 2;

// The parts of the paragraph lines that follow the leading text (LTR text).
// The leading text laid out alone breaks like the paragraph, so its last line
// is the paragraph line where the dashed text starts, and its width says where
// on that line, whatever the alignment. That width leaves out a trailing
// space; the copy ending in a word joiner keeps it, when that copy breaks the
// same way (it can wrap one word earlier).
function getTrailingLines(
  lines: ITextLine[],
  leadingLines: ITextLine[],
  leadingLinesWithSpace: ITextLine[],
): ITextLine[] {
  const leadingEnd = leadingLines[leadingLines.length - 1];
  if (!leadingEnd) {
    return [];
  }
  const startWidth =
    leadingLinesWithSpace.length === leadingLines.length
      ? leadingLinesWithSpace[leadingLinesWithSpace.length - 1].width
      : leadingEnd.width;
  return lines
    .slice(leadingLines.length - 1)
    .map((line, index) => {
      const x = index === 0 ? line.x + startWidth : line.x;
      return { ...line, x, width: line.x + line.width - x };
    })
    .filter((line) => line.width >= 1);
}

type ITextLayoutHandler = Exclude<
  ISizableTextProps['onTextLayout'],
  'unset' | undefined
>;

// An invisible copy of the text at the paragraph's width, laid out only to
// read its lines; it gets just the props that affect layout.
function TextLayoutProbe({
  textProps,
  width,
  onTextLayout,
  children,
}: {
  textProps: ISizableTextProps;
  width: number;
  onTextLayout: ITextLayoutHandler;
  children: ReactNode;
}) {
  return (
    <SizableText
      size={textProps.size}
      fontSize={textProps.fontSize}
      fontFamily={textProps.fontFamily}
      fontWeight={textProps.fontWeight}
      fontStyle={textProps.fontStyle}
      fontVariant={textProps.fontVariant}
      lineHeight={textProps.lineHeight}
      letterSpacing={textProps.letterSpacing}
      textTransform={textProps.textTransform}
      position="absolute"
      top={0}
      left={0}
      width={width}
      opacity={0}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onTextLayout={onTextLayout}
    >
      {children}
    </SizableText>
  );
}

function MeasuredTextDashes({
  textProps,
  textLines,
  textLayout,
  wrapperWidth,
  leadingText,
  dashOffset,
  dashThickness,
  dashGap,
  renderDashes,
}: {
  textProps: ISizableTextProps;
  textLines: ITextLine[];
  textLayout?: LayoutRectangle;
  wrapperWidth: number;
  leadingText?: ReactNode;
  dashOffset: number;
  dashThickness: number;
  dashGap: number;
  renderDashes: (width: number) => ReactNode;
}) {
  const resolvedStyle = useStyle(textProps, {
    forComponent: StyledSizableText,
    resolveValues: 'value',
  });
  const rawStyle = StyleSheet.flatten(textProps.style as StyleProp<TextStyle>);
  const style = {
    ...resolvedStyle,
    ...(rawStyle && normalizeStyle(rawStyle, true)),
  } as Pick<
    TextStyle,
    | 'paddingTop'
    | 'paddingLeft'
    | 'paddingRight'
    | 'paddingStart'
    | 'paddingEnd'
  >;
  const rtl = I18nManager.isRTL;
  const swap = rtl && I18nManager.doLeftAndRightSwapInRTL;
  const padding = (value: TextStyle['padding']) => {
    if (typeof value === 'number') {
      return Math.max(0, value);
    }
    return typeof value === 'string' && value.endsWith('%')
      ? (Math.max(0, Number.parseFloat(value)) * wrapperWidth) / 100
      : 0;
  };
  // Fabric measures lines inside the text's content box. Its padding uses
  // the containing block's width, including for vertical percentages.
  const leftInset = padding(
    swap
      ? (style.paddingRight ?? style.paddingEnd)
      : ((rtl ? style.paddingEnd : style.paddingStart) ?? style.paddingLeft),
  );
  const rightInset = padding(
    swap
      ? (style.paddingLeft ?? style.paddingStart)
      : ((rtl ? style.paddingStart : style.paddingEnd) ?? style.paddingRight),
  );
  const topInset = padding(style.paddingTop);
  const textWidth = Math.max(
    0,
    (textLayout?.width ?? 0) - leftInset - rightInset,
  );
  const [leadingMeasurements, setLeadingMeasurements] = useState<{
    plain?: { width: number; lines: ITextLine[] };
    withSpace?: { width: number; lines: ITextLine[] };
  }>({});
  const measureLeading =
    (key: keyof typeof leadingMeasurements): ITextLayoutHandler =>
    ({ nativeEvent: { lines } }) => {
      setLeadingMeasurements((previous) => ({
        ...previous,
        [key]: { width: textWidth, lines },
      }));
    };
  const { plain, withSpace } = leadingMeasurements;
  let dashedLines = textLines;
  if (leadingText !== undefined) {
    dashedLines =
      plain?.width === textWidth && withSpace?.width === textWidth
        ? getTrailingLines(textLines, plain.lines, withSpace.lines)
        : [];
  }
  return (
    <>
      {leadingText !== undefined && textWidth > 0 ? (
        // The joiner preserves the trailing space in the second measurement.
        <Fragment key={`probes-${textWidth}`}>
          <TextLayoutProbe
            textProps={textProps}
            width={textWidth}
            onTextLayout={measureLeading('plain')}
          >
            {leadingText}
          </TextLayoutProbe>
          <TextLayoutProbe
            textProps={textProps}
            width={textWidth}
            onTextLayout={measureLeading('withSpace')}
          >
            {leadingText}
            {'\u2060'}
          </TextLayoutProbe>
        </Fragment>
      ) : null}
      {dashedLines.map((line, lineIndex) => {
        const left = (textLayout?.x ?? 0) + leftInset + line.x;
        const top = (textLayout?.y ?? 0) + topInset + line.y;
        return (
          <XStack
            key={lineIndex}
            position="absolute"
            // Text layout reports physical x coordinates, even in RTL.
            start={rtl ? undefined : left}
            end={rtl ? left : undefined}
            flexDirection={rtl ? 'row-reverse' : 'row'}
            top={top + line.height + dashOffset}
            width={line.width}
            height={dashThickness}
            gap={dashGap}
            overflow="hidden"
            pointerEvents="none"
          >
            {renderDashes(line.width)}
          </XStack>
        );
      })}
    </>
  );
}

function DashTextCore({
  children,
  dashLength = DEFAULT_DASH_LENGTH,
  dashGap = DEFAULT_DASH_GAP,
  dashThickness = 0.5,
  dashSpacing = 1,
  dashColor = '$borderStrong',
  dashOverlay = false,
  multiline: multilineProp = false,
  leadingText,
  length: maxDashCount,
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
  const multiline = multilineProp || leadingText !== undefined;
  const length = maxDashCount ?? 200;
  const theme = useTheme();
  const [textWidth, setTextWidth] = useState(0);
  const [textLines, setTextLines] = useState<ITextLine[]>([]);
  const [paragraphLayout, setParagraphLayout] = useState<LayoutRectangle>();
  const handleTextLayout = useCallback<ITextLayoutHandler>(
    (event) => {
      setTextLines(event.nativeEvent.lines);
      if (typeof onTextLayout === 'function') {
        onTextLayout(event);
      }
    },
    [onTextLayout],
  );
  const webDashThickness = Math.max(1, dashThickness);
  const webDashScaleY = Math.max(0, Math.min(1, dashThickness));
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
            WebkitMaskSize: `${dashLength + dashGap}px ${webDashThickness}px`,
            maskImage: `repeating-linear-gradient(to right, #000 0 ${dashLength}px, #000 ${dashLength}px, transparent ${dashLength}px, transparent ${
              dashLength + dashGap
            }px)`,
            maskPosition: 'left bottom',
            maskRepeat: 'repeat-x',
            maskSize: `${dashLength + dashGap}px ${webDashThickness}px`,
            transform: `translateZ(0) scaleY(${webDashScaleY})`,
            transformOrigin: 'top left',
          },
    [dashGap, dashLength, webDashThickness, webDashScaleY],
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

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  }, []);

  const onLayout = textProps.onLayout;
  const handleParagraphLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setParagraphLayout(event.nativeEvent.layout);
      onLayout?.(event);
    },
    [onLayout],
  );

  const overlayProps = dashOverlay
    ? ({ position: 'absolute', bottom: 0, left: 0, right: 0 } as const)
    : undefined;

  const renderDashes = useCallback(
    (width: number) => {
      const period = dashLength + dashGap;
      const count =
        period > 0 && width > 0
          ? Math.min(length, Math.ceil(width / period))
          : 0;
      return Array.from({ length: count }, (_, index) => (
        <YStack
          key={index}
          width={dashLength}
          height={dashThickness}
          bg={dashColor}
          flexShrink={0}
        />
      ));
    },
    [dashColor, dashGap, dashLength, dashThickness, length],
  );

  if (!platformEnv.isNative) {
    const webDashedChildren =
      multiline && length > 0 ? (
        <span style={webMultilineStyle}>{children}</span>
      ) : (
        children
      );
    return (
      <YStack alignItems="flex-start" style={webDashWrapperStyle}>
        <SizableText
          {...textProps}
          onTextLayout={onTextLayout}
          paddingBottom={dashOverlay ? 0 : '$0.2'}
          maxWidth={multiline ? '100%' : textProps.maxWidth}
        >
          {leadingText === undefined ? (
            webDashedChildren
          ) : (
            <>
              {leadingText}
              {webDashedChildren}
            </>
          )}
        </SizableText>
        {length > 0 && !multiline ? (
          <YStack
            width="100%"
            mt={dashOverlay ? 0 : dashSpacing}
            height={webDashThickness}
            bg={dashColor}
            pointerEvents="none"
            style={webDashLineStyle}
            {...overlayProps}
          />
        ) : null}
      </YStack>
    );
  }

  const hasDashes = length > 0 && dashThickness > 0;
  const textStyle = StyleSheet.flatten(textProps.style as StyleProp<TextStyle>);
  const useMeasuredDashes =
    hasDashes &&
    (leadingText !== undefined ||
      maxDashCount !== undefined ||
      textProps.textDecorationLine !== undefined ||
      textStyle?.textDecorationLine !== undefined ||
      textStyle?.paddingBottom !== undefined ||
      textStyle?.paddingVertical !== undefined ||
      textStyle?.padding !== undefined ||
      (multiline &&
        (textProps.paddingBottom !== undefined ||
          textProps.paddingVertical !== undefined ||
          textProps.padding !== undefined ||
          textProps.pb !== undefined ||
          textProps.py !== undefined ||
          textProps.p !== undefined)) ||
      dashLength !== DEFAULT_DASH_LENGTH ||
      dashGap !== DEFAULT_DASH_GAP);

  // Android treats transparent decoration as a request to use the text color.
  const nativeDashColor = platformEnv.isNativeAndroid
    ? processColor(dashColorValue)
    : undefined;
  const hasVisibleDashColor =
    typeof nativeDashColor !== 'number' || nativeDashColor >>> 24 !== 0;
  let nativeDashMode = 'single';
  if (dashOverlay) {
    nativeDashMode = 'overlay';
  } else if (multiline) {
    nativeDashMode = 'multiline';
  }
  const decorationProps =
    hasDashes && !useMeasuredDashes && hasVisibleDashColor
      ? ({
          textDecorationLine: 'underline',
          textDecorationStyle: 'dashed',
          textDecorationColor: dashColor,
          onekeyDashText: `${dashThickness},${nativeDashMode === 'multiline' ? dashSpacing : 0},${nativeDashMode}`,
        } as const)
      : undefined;
  const reservesDashHeight = !dashOverlay && length > 0;
  // Put the existing space for the rule inside the text's drawable bounds.
  const nativeDashPadding =
    decorationProps && reservesDashHeight
      ? (multiline ? dashSpacing : 0) + dashThickness
      : undefined;

  if (multiline) {
    const hasLeadingText = leadingText !== undefined;
    const dashOffset = dashOverlay ? -dashThickness : dashSpacing;
    return (
      <YStack
        maxWidth="100%"
        onLayout={useMeasuredDashes ? handleLayout : undefined}
        paddingBottom={
          reservesDashHeight && nativeDashPadding === undefined
            ? dashSpacing + dashThickness
            : 0
        }
      >
        <SizableText
          {...textProps}
          {...decorationProps}
          {...(nativeDashPadding === undefined
            ? undefined
            : { paddingBottom: nativeDashPadding })}
          onLayout={
            hasLeadingText || useMeasuredDashes
              ? handleParagraphLayout
              : onLayout
          }
          onTextLayout={
            hasLeadingText || useMeasuredDashes || onTextLayout
              ? handleTextLayout
              : undefined
          }
        >
          {leadingText}
          {children}
        </SizableText>
        {useMeasuredDashes ? (
          <MeasuredTextDashes
            textProps={textProps}
            textLines={textLines}
            textLayout={paragraphLayout}
            wrapperWidth={textWidth}
            leadingText={leadingText}
            dashOffset={dashOffset}
            dashThickness={dashThickness}
            dashGap={dashGap}
            renderDashes={renderDashes}
          />
        ) : null}
      </YStack>
    );
  }

  const label = (
    <SizableText
      {...textProps}
      {...decorationProps}
      onTextLayout={onTextLayout}
      paddingBottom={nativeDashPadding ?? (dashOverlay ? 0 : '$0.2')}
    >
      {children}
    </SizableText>
  );
  return (
    <YStack
      alignItems="flex-start"
      paddingBottom={
        !useMeasuredDashes &&
        reservesDashHeight &&
        nativeDashPadding === undefined
          ? dashThickness
          : 0
      }
    >
      {useMeasuredDashes ? (
        <>
          <YStack onLayout={handleLayout}>{label}</YStack>
          <XStack
            gap={dashGap}
            height={dashThickness}
            overflow="hidden"
            flexWrap="nowrap"
            width={textWidth}
            {...overlayProps}
          >
            {renderDashes(textWidth)}
          </XStack>
        </>
      ) : (
        label
      )}
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
