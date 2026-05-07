import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPuzzle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 1a3.5 3.5 0 0 1 3.464 3H21v6.5h-1.5a1.5 1.5 0 0 0 0 3H21V20H3V4h5.536A3.5 3.5 0 0 1 12 1m0 2a1.5 1.5 0 0 0-1.5 1.5V6H5v12h14v-2.536a3.5 3.5 0 0 1 0-6.929V6h-5.5V4.5A1.5 1.5 0 0 0 12 3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPuzzle;
