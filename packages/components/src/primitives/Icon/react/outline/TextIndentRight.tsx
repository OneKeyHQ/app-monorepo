import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextIndentRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 17a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm6.337-8.408A1 1 0 0 1 22 9.34v5.31a1 1 0 0 1-1.662.75l-3-2.651a1 1 0 0 1-.001-1.497zM14 11a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm0-6a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgTextIndentRight;
