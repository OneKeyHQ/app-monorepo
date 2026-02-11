import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Add = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 6v13h14V6zm5.999 9v-1.5H9.5a1 1 0 1 1 0-2h1.499V10a1 1 0 0 1 2 0v1.5H14.5a1 1 0 1 1 0 2h-1.501V15a1 1 0 1 1-2 0M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 2 0v1h6V3a1 1 0 1 1 2 0v1h2a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCalendar3Add;
