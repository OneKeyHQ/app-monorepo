import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBag = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 11V9H9v2a1 1 0 1 1-2 0V9H5v10h14V9h-2v2a1 1 0 1 1-2 0M9 7h6V5H9zm12 12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h3V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3h3a1 1 0 0 1 1 1z" />
  </Svg>
);
export default SvgBag;
