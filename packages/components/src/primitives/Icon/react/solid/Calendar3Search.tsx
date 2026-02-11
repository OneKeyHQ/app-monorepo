import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Search = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.75 10.75a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5" />
    <Path
      fillRule="evenodd"
      d="M16 2.5a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2v-1a1 1 0 0 1 2 0v1h6v-1a1 1 0 0 1 1-1m-4.25 6.25a3.75 3.75 0 1 0 1.849 7.014l.694.693a1 1 0 1 0 1.414-1.414l-.693-.694A3.75 3.75 0 0 0 11.75 8.75"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Search;
