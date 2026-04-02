import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottomLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m19.621 6.5-9.5 9.5H16v3H5V8h3v5.879l9.5-9.5 2.121 2.12Z" />
  </Svg>
);
export default SvgArrowBottomLeft;
