import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutTopbar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 21H3V11h8zm10-10v10h-8V11zm0-2H3V3h18z" />
  </Svg>
);
export default SvgLayoutTopbar;
