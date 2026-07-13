import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLimitOrder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 36 36" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeDasharray="1 2"
      strokeLinecap="round"
      strokeOpacity={0.4}
      d="M3 22h19M30 22h4"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7.5 11h11.7l5.3 8.4"
    />
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M23 22a3 3 0 1 1 6 0 3 3 0 1 1-6 0"
    />
  </Svg>
);
export default SvgLimitOrder;
