import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.002 3v16.036h-6.626l-3.382 2.802-3.343-2.802H2.002V3z" />
  </Svg>
);
export default SvgMessage;
