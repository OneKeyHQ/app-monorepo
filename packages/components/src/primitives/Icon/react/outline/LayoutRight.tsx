import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zm-6 16h4V5h-4zM5 19h8V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutRight;
