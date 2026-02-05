import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.28 3.669a.957.957 0 0 1 1.353 0l6.978 6.978a1.913 1.913 0 0 1 0 2.706L9.633 20.33a.957.957 0 0 1-1.353-1.353L15.258 12 8.28 5.022a.957.957 0 0 1 0-1.353" />
  </Svg>
);
export default SvgChevronRight;
