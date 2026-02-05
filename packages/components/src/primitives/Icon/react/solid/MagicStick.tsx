import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicStick = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.858 1.376a1.078 1.078 0 0 0-1.772.903l.349 4.523L6.57 9.178a1.077 1.077 0 0 0 .312 1.965l3.182.769-7.016 7.016a1.077 1.077 0 0 0 1.524 1.524l7.016-7.017.769 3.183a1.077 1.077 0 0 0 1.965.311l2.376-3.864 4.523.349a1.078 1.078 0 0 0 .903-1.773l-2.941-3.454 1.73-4.193a1.077 1.077 0 0 0-1.407-1.407l-4.194 1.73z" />
  </Svg>
);
export default SvgMagicStick;
