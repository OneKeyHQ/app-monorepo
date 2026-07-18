import { SegmentSlider, XStack } from '@onekeyhq/components';

interface ISwapProAmountSliderProps {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onSlideStart?: () => void;
  onSlideComplete?: () => void;
}

// Balance-percentage slider for the Pro order panel. Drag haptics fire on the
// native UI thread inside SegmentSlider each time the thumb crosses a segment
// node, so no JS-side vibration wiring is needed and the system haptics
// setting is respected by the OS.
const SwapProAmountSlider = ({
  value,
  disabled,
  onChange,
  onSlideStart,
  onSlideComplete,
}: ISwapProAmountSliderProps) => {
  return (
    <XStack px="$1">
      <SegmentSlider
        value={value}
        min={0}
        max={100}
        segments={4}
        snapTapToSegment
        sliderHeight={2}
        showBubble={false}
        disabled={disabled}
        onChange={onChange}
        onSlideStart={onSlideStart}
        onSlideComplete={onSlideComplete}
      />
    </XStack>
  );
};

export default SwapProAmountSlider;
