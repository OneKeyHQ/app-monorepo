import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCart = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M1.942 3.3a.942.942 0 0 0 0 1.884h1.086l1.622 9.731a1.884 1.884 0 0 0 1.86 1.575h11.144c.902 0 1.677-.64 1.85-1.525l1.282-6.595a1.884 1.884 0 0 0-1.85-2.244H5.095l-.208-1.252A1.884 1.884 0 0 0 3.028 3.3zm5.653 14.132a1.884 1.884 0 1 0 0 3.768 1.884 1.884 0 0 0 0-3.768m8.479 0a1.884 1.884 0 1 0 0 3.768 1.884 1.884 0 0 0 0-3.768" />
  </Svg>
);
export default SvgCart;
