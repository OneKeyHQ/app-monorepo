import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPrime = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path fillRule="evenodd" d="M1 12h4v9h7V3H4z" clipRule="evenodd" />
    <Path d="M22 11a8 8 0 0 0-8-8v16a8 8 0 0 0 8-8" />
  </Svg>
);
export default SvgPrime;
