import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBold = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 3a5 5 0 0 1 3.434 8.632A5 5 0 0 1 14 21H5V3zM7 13v6h7a3 3 0 0 0 0-6zm0-2h6a3 3 0 0 0 0-6H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBold;
