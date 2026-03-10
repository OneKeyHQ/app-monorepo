import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBook = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 22H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h13zM7 18a1 1 0 1 0 0 2h11v-2zm1-8v2h5v-2zm0-2h8V6H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBook;
