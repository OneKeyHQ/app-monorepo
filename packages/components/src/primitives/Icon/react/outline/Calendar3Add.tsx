import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Add = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 11.5h2.5v2H13V16h-2v-2.5H8.5v-2H11V9h2z" />
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v17H3V4h4V2h2zM5 19h14V6H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Add;
