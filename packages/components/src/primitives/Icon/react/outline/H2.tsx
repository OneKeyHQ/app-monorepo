import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgH2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 19v-6H4v6a1 1 0 1 1-2 0V5a1 1 0 0 1 2 0v6h8V5a1 1 0 1 1 2 0v14a1 1 0 1 1-2 0m9-5.76V13a1 1 0 0 0-1.867-.499 1 1 0 0 1-1.73-1.002A3 3 0 0 1 23 13v.24a3 3 0 0 1-.722 1.947h.002L20.062 18H22a1 1 0 1 1 0 2h-4a1 1 0 0 1-.785-1.62l3.495-4.43.037-.046a1 1 0 0 0 .253-.665Z" />
  </Svg>
);
export default SvgH2;
