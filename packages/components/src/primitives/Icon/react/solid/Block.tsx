import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBlock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.743 5.672A9.96 9.96 0 0 1 22 12c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-6.33-2.257L19.744 5.672ZM12 2a9.96 9.96 0 0 1 6.33 2.257L4.256 18.329A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2" />
  </Svg>
);
export default SvgBlock;
