import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMarketOrder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 36 36" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeDasharray="1 2"
      strokeLinecap="round"
      strokeOpacity={0.4}
      d="M3 11h17.5M31.5 11H34"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7.1 26.9 23.7 13"
    />
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M23 11a3 3 0 1 1 6 0 3 3 0 1 1-6 0"
    />
  </Svg>
);
export default SvgMarketOrder;
