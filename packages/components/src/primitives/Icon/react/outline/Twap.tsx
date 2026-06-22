import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTwap = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 36 36" accessibilityRole="image" {...props}>
    <Path
      fill="#00000000"
      stroke="currentColor"
      strokeLinecap="round"
      strokeOpacity={0.6}
      strokeWidth={2}
      d="M18 13.5V18l2.5 2"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 18a9 9 0 0 1 9-9 9 9 0 0 1 9 9 8.98 8.98 0 0 1-3.262 6.934q1.057.355 2.051.834A10.97 10.97 0 0 0 29 18c0-6.075-4.925-11-11-11S7 11.925 7 18c0 3.032 1.227 5.778 3.211 7.768a18 18 0 0 1 2.051-.834A8.98 8.98 0 0 1 9 18"
      clipRule="evenodd"
    />
    <Path
      fill="#00000000"
      stroke="currentColor"
      strokeLinecap="round"
      strokeOpacity={0.6}
      strokeWidth={2}
      d="M8.843 26.5A17.9 17.9 0 0 1 18 24c3.487 0 6.743.992 9.5 2.708"
    />
  </Svg>
);
export default SvgTwap;
