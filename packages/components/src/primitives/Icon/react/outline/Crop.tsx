import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 7v10h10V7zm12 10h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2H7a2 2 0 0 1-2-2V7H3a1 1 0 0 1 0-2h2V3a1 1 0 0 1 2 0v2h10a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCrop;
