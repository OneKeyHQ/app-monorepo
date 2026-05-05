import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXzy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.414 7 12 8.414l-2-2V14h11v2H9.414L4 21.414 2.586 20 8 14.586V6.414l-2 2L4.586 7 9 2.586z" />
  </Svg>
);
export default SvgXzy;
