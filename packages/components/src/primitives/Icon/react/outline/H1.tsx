import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgH1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 19v-6H4v6a1 1 0 1 1-2 0V5a1 1 0 0 1 2 0v6h8V5a1 1 0 1 1 2 0v14a1 1 0 1 1-2 0m8 0v-5.864l-1.36 1.133a1.001 1.001 0 0 1-1.28-1.538l3-2.5A1 1 0 0 1 22 11v8a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgH1;
