import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerLeftDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.98 5.01C7.98 3.9 8.88 3 9.99 3h9.043a1.005 1.005 0 1 1 0 2.01H9.99v12.645l2.304-2.303a1.005 1.005 0 1 1 1.421 1.42l-4.019 4.02a1.005 1.005 0 0 1-1.42 0l-4.02-4.02a1.005 1.005 0 1 1 1.42-1.42l2.305 2.303z" />
  </Svg>
);
export default SvgCornerLeftDown;
