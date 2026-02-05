import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUndo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.207 4.293a1 1 0 0 1 0 1.414L4.914 8H17a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5h-5a1 1 0 1 1 0-2h5a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3H4.914l2.293 2.293a1 1 0 1 1-1.414 1.414L2.5 10.414a2 2 0 0 1 0-2.828l3.293-3.293a1 1 0 0 1 1.414 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUndo;
