import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCart = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2 4h1.306a2 2 0 0 1 1.973 1.671L5.5 7m0 0 1.221 7.329A2 2 0 0 0 8.694 16h8.112a2 2 0 0 0 1.973-1.671l1.027-6.165A1 1 0 0 0 18.82 7z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={0.5}
      d="M8.25 21.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m9 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5"
    />
  </Svg>
);
export default SvgCart;
