import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgListSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.366 4.5a7 7 0 0 1 5.605 11.194l2.098 2.099a1 1 0 1 1-1.414 1.414l-2.1-2.1A7 7 0 1 1 14.365 4.5Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10"
      clipRule="evenodd"
    />
    <Path d="M5.366 15.5a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2zm-1-5a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm1-5a1 1 0 0 1 0 2h-3a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgListSearch;
