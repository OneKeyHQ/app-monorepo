import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCart = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.71 19.316a1.884 1.884 0 1 1 3.77 0 1.884 1.884 0 0 1-3.77 0m8.48 0a1.884 1.884 0 1 1 3.768 0 1.884 1.884 0 0 1-3.768 0M3.029 3.3c.92 0 1.707.666 1.858 1.574l.21 1.252h13.838a1.884 1.884 0 0 1 1.85 2.244l-1.283 6.595a1.884 1.884 0 0 1-1.85 1.525H6.509c-.92 0-1.707-.666-1.858-1.575L3.029 5.184H1.942a.942.942 0 0 1 0-1.884zm3.48 11.305h11.144l1.283-6.595H5.41l1.098 6.595Z" />
  </Svg>
);
export default SvgCart;
