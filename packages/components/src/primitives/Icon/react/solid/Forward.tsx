import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgForward = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M23.505 12 12 22.227v-5.72c-3.59.058-5.51.429-6.678 1.012-1.18.59-1.682 1.437-2.427 2.928L1 20c0-4.284.615-7.506 2.581-9.618C5.409 8.418 8.201 7.627 12 7.515V1.773z" />
  </Svg>
);
export default SvgForward;
