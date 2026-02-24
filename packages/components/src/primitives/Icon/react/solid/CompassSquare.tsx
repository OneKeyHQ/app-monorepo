import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCompassSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM9.567 9.567 8.56 15.44l5.873-1.007L15.44 8.56z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompassSquare;
