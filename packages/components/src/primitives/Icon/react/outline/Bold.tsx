import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBold = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 16a3 3 0 0 0-3-3H7v6h7a3 3 0 0 0 3-3m2 0a5 5 0 0 1-5 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6a5 5 0 0 1 3.434 8.632A5 5 0 0 1 19 16M7 11h6a3 3 0 1 0 0-6H7z" />
  </Svg>
);
export default SvgBold;
