import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewLine = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.837 6.36a.96.96 0 0 1 1.498 1.198l-7.016 8.77a1.92 1.92 0 0 1-2.82.191l-5.24-4.99-4.133 4.592A.958.958 0 1 1 1.7 14.84l4.133-4.593a1.92 1.92 0 0 1 2.748-.106l5.24 4.99 7.015-8.77Z" />
  </Svg>
);
export default SvgTradingViewLine;
