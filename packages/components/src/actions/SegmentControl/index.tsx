import type { ReactElement } from 'react';
import { forwardRef, useCallback, useRef, useState } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import type {
  GetProps,
  TamaguiElement,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SizableText, XStack, YStack } from '../../primitives';

import type { IXStackProps } from '../../primitives';
import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';

const gtMdStyle = { zIndex: 4 } as const;
const hoverStyleConst = { bg: '$bgHover' } as const;
const pressStyleConst = { bg: '$bgActive' } as const;
const focusVisibleStyleConst = {
  outlineWidth: 2,
  outlineColor: '$focusRing',
  outlineStyle: 'solid',
} as const;
const THUMB_ANIMATE_ONLY = ['transform', 'width'];
// Soft drop shadow plus a hairline ring, so the thumb keeps its edge on a
// light track.
const THUMB_SHADOW =
  '0 1px 2px 0 rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.06)';
const LAYOUT_EPSILON = 0.1;

type IItemStyleProps = Omit<GetProps<typeof YStack>, 'onChange'>;

export interface ISegmentControlProps extends Omit<IXStackProps, 'onChange'> {
  fullWidth?: boolean;
  value: string | number;
  options: {
    label: string | ReactElement;
    value: string | number;
    testID?: string;
    disabled?: boolean;
  }[];
  onChange: (value: string | number) => void;
  segmentControlItemStyleProps?: IItemStyleProps;
  slotBackgroundColor?: IXStackProps['backgroundColor'];
  // Passing this opts out of the floating thumb: the highlight turns flat and
  // the control keeps the geometry, inactive text color and hover states it
  // had before the thumb existed.
  activeBackgroundColor?: GetProps<typeof YStack>['bg'];
  activeTextColor?: string;
  inactiveTextColor?: string;
}

function isSameLayout(a: LayoutRectangle | undefined, b: LayoutRectangle) {
  return (
    !!a &&
    Math.abs(a.x - b.x) < LAYOUT_EPSILON &&
    Math.abs(a.y - b.y) < LAYOUT_EPSILON &&
    Math.abs(a.width - b.width) < LAYOUT_EPSILON &&
    Math.abs(a.height - b.height) < LAYOUT_EPSILON
  );
}

function SegmentControlItem({
  label,
  value,
  index,
  onChange,
  onItemLayout,
  active,
  floating,
  disabled,
  activeTextColor,
  inactiveTextColor,
  testID,
  ...rest
}: {
  label: string | ReactElement;
  value: string | number;
  index: number;
  active: boolean;
  floating: boolean;
  disabled?: boolean;
  onChange: (value: string | number) => void;
  onItemLayout: (index: number, layout: LayoutRectangle) => void;
  activeTextColor?: string;
  inactiveTextColor?: string;
} & IItemStyleProps) {
  const ref = useRef<TamaguiElement>(null);
  const [hovered, setHovered] = useState(false);
  const handleChange = useCallback(() => {
    onChange(value);
  }, [onChange, value]);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      let { x, y, width, height } = e.nativeEvent.layout;
      // A hidden control (display: none) reports an empty rect. Keep the last
      // real one so the thumb is already in place when it shows again.
      if (width <= 0 || height <= 0) {
        return;
      }
      const node = ref.current;
      // Gate on the platform, not on the node type: React Native exposes its
      // host elements as a global HTMLElement too, without getComputedStyle.
      if (!platformEnv.isNative && node instanceof HTMLElement) {
        // Web layout events are measured with getBoundingClientRect, so they
        // carry any ancestor scale (Dialog and Popover scale in on enter).
        // Divide it back out with the untransformed CSS box size.
        const style = getComputedStyle(node);
        const cssWidth = parseFloat(style.width);
        const cssHeight = parseFloat(style.height);
        if (cssWidth > 0 && cssHeight > 0) {
          x *= cssWidth / width;
          y *= cssHeight / height;
          width = cssWidth;
          height = cssHeight;
        }
      }
      onItemLayout(index, { x, y, width, height });
    },
    [index, onItemLayout],
  );

  let textColor = inactiveTextColor ?? (floating ? '$textSubdued' : '$text');
  if (active) {
    textColor = activeTextColor ?? '$text';
  } else if (floating && hovered && !disabled) {
    textColor = '$text';
  }

  return (
    <YStack
      ref={ref}
      py={floating ? '$1' : '$1.5'}
      px={floating ? '$3' : '$3.5'}
      $gtMd={gtMdStyle}
      onPress={handleChange}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      borderRadius="$full"
      borderCurve="continuous"
      userSelect="none"
      focusable={!disabled}
      focusVisibleStyle={focusVisibleStyleConst}
      testID={testID}
      {...(!active &&
        !floating && {
          hoverStyle: hoverStyleConst,
          pressStyle: pressStyleConst,
        })}
      {...(disabled && {
        opacity: 0.5,
      })}
      {...rest}
      onLayout={handleLayout}
    >
      {typeof label === 'string' ? (
        <SizableText
          size="$bodyMdMedium"
          textAlign="center"
          numberOfLines={1}
          color={textColor}
        >
          {label}
        </SizableText>
      ) : (
        label
      )}
    </YStack>
  );
}

function SegmentControlFrame(
  {
    value,
    options,
    onChange,
    fullWidth,
    segmentControlItemStyleProps,
    slotBackgroundColor,
    activeBackgroundColor,
    activeTextColor,
    inactiveTextColor,
    ...rest
  }: ISegmentControlProps,
  ref: React.ForwardedRef<TamaguiElement>,
) {
  const floating = activeBackgroundColor === undefined;
  const reducedMotion = useReducedMotion();
  // Keyed by option index: a slot keeps its rect when options are swapped
  // for others of the same size, which fires no new layout event.
  const [itemLayouts, setItemLayouts] = useState<
    Record<number, LayoutRectangle>
  >({});
  const handleChange = useCallback(
    (v: string | number) => {
      onChange(v);
    },
    [onChange],
  );
  const handleItemLayout = useCallback(
    (index: number, layout: LayoutRectangle) => {
      setItemLayouts((prev) =>
        isSameLayout(prev[index], layout) ? prev : { ...prev, [index]: layout },
      );
    },
    [],
  );
  const activeIndex = options.findIndex((option) => option.value === value);
  const highlightStyle = {
    bg: activeBackgroundColor ?? '$bgSegmentThumb',
    boxShadow: floating ? THUMB_SHADOW : undefined,
  } satisfies IItemStyleProps;
  // A transparent highlight has nothing to draw, so it gets no thumb.
  const thumbLayout =
    activeBackgroundColor !== '$transparent' && activeIndex >= 0
      ? itemLayouts[activeIndex]
      : undefined;

  return (
    <XStack
      ref={ref}
      width={fullWidth ? '100%' : 'auto'}
      alignSelf={fullWidth ? undefined : 'flex-start'}
      backgroundColor={slotBackgroundColor ?? '$bgStrong'}
      borderRadius="$full"
      borderCurve="continuous"
      overflow="hidden"
      h={32}
      p={floating ? '$0.5' : undefined}
      {...rest}
    >
      {thumbLayout ? (
        <YStack
          position="absolute"
          top={0}
          left={0}
          x={thumbLayout.x}
          y={thumbLayout.y}
          width={thumbLayout.width}
          height={thumbLayout.height}
          pointerEvents="none"
          borderRadius={segmentControlItemStyleProps?.borderRadius ?? '$full'}
          borderCurve="continuous"
          transition={reducedMotion ? '0ms' : 'switch'}
          animateOnly={THUMB_ANIMATE_ONLY}
          // Measured geometry would otherwise mint a permanent atomic CSS
          // class per thumb position on web.
          disableClassName
          {...highlightStyle}
        />
      ) : null}
      {options.map(({ label, value: v, testID, disabled }, index) => (
        <SegmentControlItem
          testID={testID}
          key={index}
          index={index}
          label={label}
          value={v}
          active={value === v}
          floating={floating}
          disabled={disabled}
          onChange={handleChange}
          onItemLayout={handleItemLayout}
          activeTextColor={activeTextColor}
          inactiveTextColor={inactiveTextColor}
          // The thumb is positioned from a measured layout. Until that layout
          // arrives the active item paints the highlight itself, so the
          // control never renders a frame without a selection.
          {...(value === v && !thumbLayout && highlightStyle)}
          {...(fullWidth && {
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
          })}
          {...segmentControlItemStyleProps}
        />
      ))}
    </XStack>
  );
}

export const SegmentControl = forwardRef<TamaguiElement, ISegmentControlProps>(
  SegmentControlFrame,
);
