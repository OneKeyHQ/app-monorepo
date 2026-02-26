import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 11v10H3V11zM9 4h6V2h2v2h4v5H3V4h4V2h2z" />
  </Svg>
);
export default SvgCalendar2;
