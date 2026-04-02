import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.376 4.673 17.713 9H20v13H4V9h11.364l3.309-5.376zM9 15h6v-2H9z"
      clipRule="evenodd"
    />
    <Path d="M8.333 4.667 10 5.5l-1.667.833L7.5 8l-.833-1.667L5 5.5l1.667-.833L7.5 3zM14 3l2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
  </Svg>
);
export default SvgMagicBox;
