import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3CheckDone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8 2.5a1 1 0 0 1 1 1v1h6v-1a1 1 0 1 1 2 0v1h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2v-1a1 1 0 0 1 1-1m7.207 8.043a1 1 0 0 1 0 1.414l-3.5 3.5a1 1 0 0 1-1.414 0l-1.5-1.5a1 1 0 1 1 1.414-1.414l.793.793 2.793-2.793a1 1 0 0 1 1.414 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3CheckDone;
