import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBacktrack = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m8.4 6-4.286 6 4.287 6h11.485V6zm6.03 3.293a1 1 0 0 1 1.414 1.414l-1.295 1.294 1.294 1.294a1 1 0 0 1-1.414 1.414l-1.294-1.294-1.292 1.294a1 1 0 0 1-1.414-1.414L11.72 12l-1.294-1.294a1 1 0 1 1 1.414-1.414l1.294 1.294zM21.886 18a2 2 0 0 1-2 2H8.4a2 2 0 0 1-1.628-.838l-4.287-6a2 2 0 0 1 0-2.324l4.287-6A2 2 0 0 1 8.4 4h11.485a2 2 0 0 1 2 2v12Z" />
  </Svg>
);
export default SvgBacktrack;
