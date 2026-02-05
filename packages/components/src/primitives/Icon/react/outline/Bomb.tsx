import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBomb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 14a6 6 0 1 0-12 0 6 6 0 0 0 12 0m6-8a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zm-1.707-3.707a1 1 0 1 1 1.414 1.414l-1 1a1 1 0 1 1-1.414-1.414zM16 3V2a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0m2 11a8 8 0 1 1-3.097-6.318l1.39-1.389a1 1 0 1 1 1.414 1.414l-1.39 1.389A7.96 7.96 0 0 1 18 14" />
  </Svg>
);
export default SvgBomb;
