import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCompassCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.602 7.724a1.5 1.5 0 0 1 1.632 1.883l-1.119 4.105a2 2 0 0 1-1.403 1.403l-4.105 1.12a1.5 1.5 0 0 1-1.841-1.842l1.119-4.105a2 2 0 0 1 1.403-1.403l4.105-1.12zm-3.787 3.09-.89 3.26 3.26-.889.89-3.26-3.26.89Z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompassCircle;
