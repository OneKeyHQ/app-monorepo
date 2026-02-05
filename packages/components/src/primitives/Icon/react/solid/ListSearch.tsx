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
      d="M14.366 4.5a7 7 0 1 0 4.19 12.608l2.099 2.1a1 1 0 0 0 1.414-1.415l-2.098-2.099A7 7 0 0 0 14.366 4.5m-.004 4a3 3 0 0 0-3 3 1 1 0 1 1-2 0 5 5 0 0 1 5-5 1 1 0 1 1 0 2"
      clipRule="evenodd"
    />
    <Path d="M1.366 6.5a1 1 0 0 1 1-1h3a1 1 0 0 1 0 2h-3a1 1 0 0 1-1-1m0 5a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1m1 4a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2z" />
  </Svg>
);
export default SvgListSearch;
