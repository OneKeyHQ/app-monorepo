import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM11 19h8V5h-8zm-6 0h4V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutLeft;
