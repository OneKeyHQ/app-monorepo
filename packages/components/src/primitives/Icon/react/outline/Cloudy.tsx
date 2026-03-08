import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 4a8 8 0 0 1 6.979 4.087A6 6 0 1 1 17 20H9A8 8 0 1 1 9 4m0 2a6 6 0 1 0 0 12h8a4 4 0 1 0-1.249-7.802l-.871.286-.36-.842A6 6 0 0 0 9 6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudy;
