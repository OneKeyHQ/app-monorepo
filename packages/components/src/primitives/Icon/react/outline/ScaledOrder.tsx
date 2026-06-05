import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgScaledOrder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 36 36" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeDasharray="1 2"
      strokeLinecap="round"
      strokeOpacity={0.4}
      d="M3 18h31M3 26.5h31"
    />
    <Path
      fill="#00000000"
      stroke="currentColor"
      strokeLinecap="round"
      strokeOpacity={0.4}
      d="M3 9h17.5M31.5 9H34"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m11.6 23.9 3.3-3.3M20.1 15.4l3.1-3.3"
    />
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M22.5 9a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0"
    />
    <Path
      fill="currentColor"
      d="M13.7 18a3.8 3.8 0 1 1 7.6 0 3.8 3.8 0 1 1-7.6 0M5.2 26.5a3.8 3.8 0 1 1 7.6 0 3.8 3.8 0 1 1-7.6 0"
    />
  </Svg>
);
export default SvgScaledOrder;
