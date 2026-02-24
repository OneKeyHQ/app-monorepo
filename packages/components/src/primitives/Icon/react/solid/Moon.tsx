import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMoon = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.278 1.968a7 7 0 0 0 9.755 9.755q.004.137.004.275c0 5.542-4.492 10.034-10.034 10.034S1.969 17.54 1.969 11.998c0-5.541 4.492-10.034 10.034-10.034q.138 0 .275.004" />
  </Svg>
);
export default SvgMoon;
