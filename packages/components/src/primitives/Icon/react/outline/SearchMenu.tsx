import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSearchMenu = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.004 12a5 5 0 1 0-10 0 5 5 0 0 0 10 0m-14 4a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2zm-1-5a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm1-5a1 1 0 0 1 0 2h-3a1 1 0 1 1 0-2zm16 6a6.97 6.97 0 0 1-1.396 4.194l2.099 2.099a1 1 0 1 1-1.414 1.414l-2.1-2.1A7 7 0 1 1 22.003 12Z" />
  </Svg>
);
export default SvgSearchMenu;
