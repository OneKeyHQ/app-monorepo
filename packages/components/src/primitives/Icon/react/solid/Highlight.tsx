import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHighlight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.414 7.5 7.914 22H2v-5.914l14.5-14.5zM22 20v2h-9v-2z" />
  </Svg>
);
export default SvgHighlight;
