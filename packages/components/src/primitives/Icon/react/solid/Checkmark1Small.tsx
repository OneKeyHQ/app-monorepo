import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark1Small = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.53 7.152a1 1 0 0 1 .318 1.378l-5 8a1 1 0 0 1-1.555.177l-3-3a1 1 0 1 1 1.414-1.414l2.111 2.111 4.334-6.934a1 1 0 0 1 1.378-.318"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckmark1Small;
