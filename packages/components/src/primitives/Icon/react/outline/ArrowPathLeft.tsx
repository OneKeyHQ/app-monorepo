import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.908 9.99a1.006 1.006 0 0 1-1.005-1.006V6.688L2.883 12l6.02 5.312v-2.296c0-.555.45-1.005 1.005-1.005h10.051V9.99zm12.061 4.02c0 1.11-.9 2.01-2.01 2.01h-9.046v2.405c0 1.298-1.531 1.99-2.505 1.13l-6.854-6.048a2.01 2.01 0 0 1 0-3.014l6.854-6.049.093-.075c.975-.74 2.412-.052 2.412 1.206V7.98h9.046c1.11 0 2.01.9 2.01 2.01z" />
  </Svg>
);
export default SvgArrowPathLeft;
