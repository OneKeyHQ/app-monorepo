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
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h11a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 19a1 1 0 0 0 1 1h11v-2H7a1 1 0 0 0-1 1M9 6a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2zm-1 5a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBook;
