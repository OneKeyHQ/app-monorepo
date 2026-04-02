import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightning = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.767 7h6.863L5.883 22.775 7.763 14H2.382l6-12h11.385zM5.618 12h4.62l-1.122 5.225L18.37 9h-5.137l3-5H9.618z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLightning;
