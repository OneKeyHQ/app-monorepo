import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.978 8.28a.957.957 0 1 1 1.353 1.353l-6.978 6.978a1.914 1.914 0 0 1-2.706 0L3.669 9.633A.957.957 0 1 1 5.022 8.28L12 15.258z" />
  </Svg>
);
export default SvgChevronBottom;
