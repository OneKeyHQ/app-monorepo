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
      d="M9 2v2h6V2h2v2h4v17H3V4h4V2zm2 10.836-1.5-1.5-1.414 1.414L11 15.664l4.914-4.914L14.5 9.336z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3CheckDone;
