import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHourglass = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m12 13.201-5 3.334V20h10v-3.465zM17 4H7v3.465l5 3.333 5-3.333zm2 3.465a2 2 0 0 1-.89 1.664L13.802 12l4.306 2.871A2 2 0 0 1 19 16.535V20h1a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2h1v-3.465a2 2 0 0 1 .89-1.664L10.198 12 5.891 9.129A2 2 0 0 1 5 7.465V4H4a1 1 0 0 1 0-2h16a1 1 0 1 1 0 2h-1z" />
  </Svg>
);
export default SvgHourglass;
