import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgScooter = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 16.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m2 0a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0m11 0a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m2 0a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0" />
    <Path d="M15.68 4a2 2 0 0 1 1.962 1.607l1.588 7.947a1 1 0 0 1-1.96.392L15.68 6H14a1 1 0 1 1 0-2zm-.18 11.5a1 1 0 1 1 0 2h-7a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgScooter;
