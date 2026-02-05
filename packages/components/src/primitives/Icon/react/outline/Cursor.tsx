import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.09 5.002c-.41-1.151.654-2.264 1.801-1.947l.11.035 16.212 5.776c1.284.458 1.338 2.254.083 2.787l-6.77 2.873-2.873 6.77c-.533 1.255-2.329 1.201-2.786-.083zm7.228 14.287 2.438-5.741.062-.13c.16-.296.418-.53.73-.662l5.741-2.438L5.351 5.35l4.967 13.938Z" />
  </Svg>
);
export default SvgCursor;
