import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoClapperboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 11H4v7h16zm-7.28-2h2.46l.6-3h-2.46zm-4.5 0h2.46l.6-3H8.82zm9.6-3-.6 3H20V6zM4 9h2.18l.6-3H4zm18 9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgVideoClapperboard;
