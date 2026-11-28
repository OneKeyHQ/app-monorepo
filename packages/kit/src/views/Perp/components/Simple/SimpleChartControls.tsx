import {
  Icon,
  ScrollView,
  SegmentControl,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import type { ITradingViewIntervalSegmentsProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/types';
import type { ITradingViewMobileControlsAppearance } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
export const SIMPLE_CHART_SEGMENT_STYLE = {
  h: 28,
  slotBackgroundColor: '$gray3',
  segmentControlItemStyleProps: {
    px: '$1.5',
    py: '$0',
    alignItems: 'center',
    justifyContent: 'center',
  },
} as const;

export const SIMPLE_CHART_ACTION_STYLE = {
  width: 28,
  height: 28,
  hitSlop: 2,
  bg: '$bgStrong',
  borderRadius: '$full',
  pressStyle: { bg: '$bgStrongActive' },
} as const;

function renderIntervals({
  options,
  activeInterval,
  moreLabel,
  moreActive,
  onMorePress,
  onSelect,
}: ITradingViewIntervalSegmentsProps) {
  const moreValue = -1;
  const selected = moreActive ? moreValue : activeInterval;
  const items = options.map((option) => ({
    ...option,
    label: (
      <SizableText
        size="$bodySmMedium"
        width={28}
        textAlign="center"
        color={option.value === selected ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {option.label}
      </SizableText>
    ),
  }));
  const more =
    moreLabel === undefined
      ? []
      : [
          {
            value: moreValue,
            testID: 'trading-view-native-interval-selector-more-select',
            label: (
              <XStack alignItems="center" gap="$0.5" px="$1">
                <SizableText
                  size="$bodySmMedium"
                  textAlign="center"
                  color={moreActive ? '$text' : '$textSubdued'}
                  numberOfLines={1}
                >
                  {moreLabel}
                </SizableText>
                <Icon
                  name="ChevronDownSmallOutline"
                  size="$3"
                  color={moreActive ? '$icon' : '$iconSubdued'}
                />
              </XStack>
            ),
          },
        ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      flexShrink={1}
    >
      <SegmentControl
        {...SIMPLE_CHART_SEGMENT_STYLE}
        value={selected}
        options={[...items, ...more]}
        onChange={(value) => {
          if (value === moreValue) onMorePress();
          else if (typeof value === 'string') onSelect(value);
        }}
      />
    </ScrollView>
  );
}

export const SIMPLE_CHART_CONTROLS = {
  renderIntervals,
  settingsButton: { ...SIMPLE_CHART_ACTION_STYLE, iconSize: '$4' },
  fullscreenButton: {
    width: 24,
    height: 24,
    p: '$0',
    hitSlop: 6,
    bg: '$bgApp',
    borderWidth: '$px',
    borderColor: '$borderSubdued',
    borderRadius: '$full',
    left: 0,
    iconSize: '$4',
  },
  denseIndicators: true,
} as const satisfies ITradingViewMobileControlsAppearance;
