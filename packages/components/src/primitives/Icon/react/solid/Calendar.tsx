import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v17H3V4h4V2h2zM5 19h14v-8H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar;
