import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Search = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.75 10.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5" />
    <Path
      fillRule="evenodd"
      d="M9 2v2h6V2h2v2h4v17H3V4h4V2zm2.75 6.25a3.75 3.75 0 1 0 1.849 7.014l1.401 1.4 1.414-1.414-1.4-1.401A3.75 3.75 0 0 0 11.75 8.25"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Search;
