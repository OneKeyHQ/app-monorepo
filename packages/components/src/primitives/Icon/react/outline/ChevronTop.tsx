import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.647 7.389a1.913 1.913 0 0 1 2.706 0l6.978 6.978a.957.957 0 0 1-1.353 1.353L12 8.742 5.022 15.72a.957.957 0 0 1-1.353-1.353z" />
  </Svg>
);
export default SvgChevronTop;
