import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSun = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.758 7.758a5.999 5.999 0 1 1 8.484 8.484 5.999 5.999 0 1 1-8.484-8.484m7.07 1.414a4 4 0 1 0-5.656 5.655 4 4 0 0 0 5.656-5.655M11 22v-1a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0m-6.067-4.347a1.001 1.001 0 0 1 1.415 1.414l-.71.71a1.001 1.001 0 0 1-1.415-1.414zm12.72 0a1 1 0 0 1 1.414 0l.71.71a1 1 0 0 1-1.415 1.414l-.71-.71a1 1 0 0 1 0-1.414ZM3 11a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2zm19 0a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zM4.223 4.223c.39-.39 1.024-.39 1.415 0l.71.71a1 1 0 0 1-1.415 1.414l-.71-.71a1 1 0 0 1 0-1.414m14.14 0a1.001 1.001 0 0 1 1.414 1.414l-.71.71a1.001 1.001 0 0 1-1.415-1.414zM11 3V2a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgSun;
