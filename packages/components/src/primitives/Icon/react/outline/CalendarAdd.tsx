import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 17h3v2h-3v3h-2v-3h-3v-2h3v-3h2z" />
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v8h-2v-2H5v9h7v2H3V4h4V2h2zM5 8h14V6H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendarAdd;
