import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXBackspace = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m8.379 6-4.286 6 4.286 6h11.485V6zm6.029 3.293a1 1 0 0 1 1.414 1.414l-1.295 1.294 1.294 1.294a1 1 0 0 1-1.414 1.414l-1.294-1.294-1.292 1.294a1 1 0 0 1-1.414-1.414L11.699 12l-1.294-1.294a1 1 0 1 1 1.414-1.414l1.294 1.294zM21.864 18a2 2 0 0 1-2 2H8.379a2 2 0 0 1-1.628-.838l-4.286-6a2 2 0 0 1 0-2.324l4.286-6A2 2 0 0 1 8.379 4h11.485l.204.01A2 2 0 0 1 21.864 6z" />
  </Svg>
);
export default SvgXBackspace;
