import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBook = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 10v2H8v-2zm3-4v2H8V6z" />
    <Path
      fillRule="evenodd"
      d="M20 2v20H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zM6 19a1 1 0 0 0 1 1h11v-2H7a1 1 0 0 0-1 1m0-2.826A3 3 0 0 1 7 16h11V4H7a1 1 0 0 0-1 1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBook;
