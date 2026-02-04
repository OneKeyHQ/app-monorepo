import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.194 3.409a1 1 0 0 1 1.613 1.182l-11.705 16a1 1 0 0 1-1.43.192l-6.294-5a1 1 0 0 1 1.244-1.566l5.479 4.352L20.193 3.41Z" />
  </Svg>
);
export default SvgCheckmark2;
