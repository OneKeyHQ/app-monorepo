import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgH3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 19v-6H4v6a1 1 0 1 1-2 0V5a1 1 0 0 1 2 0v6h8V5a1 1 0 1 1 2 0v14a1 1 0 1 1-2 0m9-2a1 1 0 0 0-.898-.995l-.204-.01a1 1 0 0 1 0-1.99l.204-.01a1 1 0 1 0-.97-1.494 1 1 0 0 1-1.73-1.002A3 3 0 1 1 22.232 15c.476.531.768 1.23.768 2a3 3 0 0 1-5.598 1.501 1 1 0 0 1 1.73-1.002A1 1 0 0 0 21 17" />
  </Svg>
);
export default SvgH3;
