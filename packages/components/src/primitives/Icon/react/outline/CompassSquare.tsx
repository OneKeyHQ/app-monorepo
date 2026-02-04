import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCompassSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 5v14h14V5zm9.602 2.724a1.5 1.5 0 0 1 1.632 1.883l-1.119 4.105a2 2 0 0 1-1.403 1.403l-4.105 1.12a1.5 1.5 0 0 1-1.841-1.842l1.119-4.105a2 2 0 0 1 1.403-1.403l4.105-1.12zm-3.787 3.09-.89 3.26 3.26-.889.89-3.26-3.26.89ZM21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCompassSquare;
