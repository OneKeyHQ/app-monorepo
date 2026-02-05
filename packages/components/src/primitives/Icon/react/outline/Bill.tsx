import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBill = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 4v14.826l.683-.585.072-.056a1 1 0 0 1 1.23.056l1.681 1.442 1.684-1.442.072-.056a1 1 0 0 1 1.228.056l1.683 1.442 1.683-1.442.072-.056a1 1 0 0 1 1.23.056l.682.585V4zm5 7a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm4-4a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm5 14a1 1 0 0 1-1.65.759l-1.684-1.442-1.682 1.442a1 1 0 0 1-1.301 0L12 20.316l-1.683 1.443a1 1 0 0 1-1.301 0l-1.683-1.442-1.683 1.442A1 1 0 0 1 4 21V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgBill;
