import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicBook = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.333 11.667 12 12.5l-1.667.833L9.5 15l-.833-1.667L7 12.5l1.667-.833L9.5 10zm4.334-4.334L17 8.5l-2.333 1.167L13.5 12l-1.167-2.333L10 8.5l2.333-1.167L13.5 5z" />
    <Path
      fillRule="evenodd"
      d="M20 22H4V2h16zM6 20h12v-2H6zm0-4h12V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicBook;
