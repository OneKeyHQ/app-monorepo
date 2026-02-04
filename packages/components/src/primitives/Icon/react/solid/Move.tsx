import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMove = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.672 2.586a2 2 0 0 1 2.828 0l2.293 2.293a1 1 0 0 1-1.414 1.414L13.086 5v6.086h6.086l-1.293-1.293a1 1 0 0 1 1.414-1.414l2.293 2.293a2 2 0 0 1 0 2.828l-2.293 2.293a1 1 0 0 1-1.414-1.414l1.293-1.293h-6.086v6.086l1.293-1.293a1 1 0 0 1 1.414 1.414L13.5 21.586a2 2 0 0 1-2.828 0l-2.293-2.293a1 1 0 1 1 1.414-1.414l1.293 1.293v-6.086H5l1.293 1.293a1 1 0 1 1-1.414 1.414L2.586 13.5a2 2 0 0 1 0-2.828l2.293-2.293a1 1 0 0 1 1.414 1.414L5 11.086h6.086V5L9.793 6.293a1 1 0 1 1-1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMove;
