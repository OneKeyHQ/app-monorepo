import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark2Small = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.247 7.342a1 1 0 0 1 1.506 1.316l-7 8a1 1 0 0 1-1.46.05l-3-3a1 1 0 1 1 1.414-1.415l2.244 2.244z" />
  </Svg>
);
export default SvgCheckmark2Small;
