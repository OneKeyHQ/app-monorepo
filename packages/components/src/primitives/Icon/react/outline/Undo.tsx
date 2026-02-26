import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUndo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m8.414 5-3 3H22v11H11v-2h9v-7H5.414l3 3L7 14.414 1.586 9 7 3.586z" />
  </Svg>
);
export default SvgUndo;
