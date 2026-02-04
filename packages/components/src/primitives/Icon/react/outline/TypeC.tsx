import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTypeC = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 12a4 4 0 0 0-4-4H6a4 4 0 1 0 0 8h12a4 4 0 0 0 4-4m-4-1a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2zm6 1a6 6 0 0 1-6 6H6A6 6 0 0 1 6 6h12a6 6 0 0 1 6 6" />
  </Svg>
);
export default SvgTypeC;
