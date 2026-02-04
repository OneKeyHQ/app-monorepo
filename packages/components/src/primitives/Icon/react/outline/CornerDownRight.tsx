import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerDownRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.336 10.293a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 1 1-1.414-1.414L17.629 16H5.043a2 2 0 0 1-2-2V5a1 1 0 1 1 2 0v9h12.586l-2.293-2.293a1 1 0 0 1 0-1.414" />
  </Svg>
);
export default SvgCornerDownRight;
