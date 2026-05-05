import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicBook = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 22H4V2h16zM6 20h12v-2H6zm2.667-8.333L7 12.5l1.667.833L9.5 15l.833-1.667L12 12.5l-1.667-.833L9.5 10zm3.666-4.334L10 8.5l2.333 1.167L13.5 12l1.167-2.333L17 8.5l-2.333-1.167L13.5 5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicBook;
