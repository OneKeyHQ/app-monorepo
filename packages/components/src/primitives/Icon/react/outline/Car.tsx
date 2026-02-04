import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 11.002 17.48 6H6.51L3 10.824V18h2v-1a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1h2zM8 12a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2zm10 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm5 6a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2H7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6.5a1 1 0 1 1 0-2h.491l3.4-4.677A2 2 0 0 1 6.51 4h10.97a2 2 0 0 1 1.636.85l3.404 4.836H23a1 1 0 0 1 0 2z" />
  </Svg>
);
export default SvgCar;
