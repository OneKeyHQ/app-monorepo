import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayerBehind = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 20H2V8h20zM11 6H4V3h7zm9 0h-7V3h7z" />
  </Svg>
);
export default SvgLayerBehind;
