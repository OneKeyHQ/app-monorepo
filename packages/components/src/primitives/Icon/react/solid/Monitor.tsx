import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMonitor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.904 3.676 14.915 6H22v15H2V6h7.087l-2.99-2.324 1.228-1.58 4.676 3.637 4.675-3.636z" />
  </Svg>
);
export default SvgMonitor;
