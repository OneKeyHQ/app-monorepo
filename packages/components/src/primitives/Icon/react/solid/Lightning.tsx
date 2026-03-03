import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightning = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m19.767 2-3 5h6.864L5.884 22.775 7.764 14H2.383l6-12z" />
  </Svg>
);
export default SvgLightning;
