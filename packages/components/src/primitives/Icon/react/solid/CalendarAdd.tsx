import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 14v3h3v2h-3v3h-2v-3h-3v-2h3v-3z" />
    <Path d="M9 2v2h6V2h2v2h4v8h-2v-2H5v9h7v2H3V4h4V2z" />
  </Svg>
);
export default SvgCalendarAdd;
