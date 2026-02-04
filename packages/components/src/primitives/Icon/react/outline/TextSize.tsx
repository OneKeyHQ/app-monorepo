import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextSize = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.927 20v-8H2a1 1 0 1 1 0-2h4.906l.02-.001.021.001H12a1 1 0 1 1 0 2H7.927v8a1 1 0 1 1-2 0M15 20V6h-5a1 1 0 1 1 0-2h12a1 1 0 1 1 0 2h-5v14a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgTextSize;
