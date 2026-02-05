import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerRightDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.01 5.01H4.967a1.005 1.005 0 1 1 0-2.01h9.043c1.11 0 2.01.9 2.01 2.01v12.645l2.303-2.303a1.005 1.005 0 1 1 1.42 1.42l-4.018 4.02a1.005 1.005 0 0 1-1.421 0l-4.02-4.02a1.005 1.005 0 1 1 1.422-1.42l2.304 2.303z" />
  </Svg>
);
export default SvgCornerRightDown;
