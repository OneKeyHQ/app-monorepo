import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImageSquare2Mountains = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.25 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 16.414V19h12.586L14 15.414l-2 2-4-4zm0-2.828 3-3 4 4 2-2 5 5V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageSquare2Mountains;
