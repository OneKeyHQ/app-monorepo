import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAirpods = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 11H5v5.5A2.5 2.5 0 0 0 7.5 19h9a2.5 2.5 0 0 0 2.5-2.5zm0-3.5A2.5 2.5 0 0 0 16.5 5h-9A2.5 2.5 0 0 0 5 7.5V9h14zm2 9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3h9A4.5 4.5 0 0 1 21 7.5z" />
    <Path d="M12.5 14.25a.5.5 0 1 0-.6.49l.1.01a.5.5 0 0 0 .5-.5m.75 0a1.25 1.25 0 0 1-2.493.128l-.006-.128.006-.128A1.25 1.25 0 0 1 12.001 13l.127.007a1.25 1.25 0 0 1 1.123 1.243Z" />
  </Svg>
);
export default SvgAirpods;
