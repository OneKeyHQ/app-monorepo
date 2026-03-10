import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3CheckDone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.914 10.75 11 15.664 8.086 12.75 9.5 11.336l1.5 1.5 3.5-3.5z" />
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v17H3V4h4V2h2zM5 19h14V6H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3CheckDone;
