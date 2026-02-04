import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlag = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 21V4a2 2 0 0 1 2-2h13.132c1.597 0 2.55 1.78 1.664 3.11L18.202 9l2.594 3.89c.886 1.33-.067 3.11-1.664 3.11H6v5a1 1 0 1 1-2 0m2-7h13.132l-2.594-3.89a2 2 0 0 1 0-2.22L19.132 4H6z" />
  </Svg>
);
export default SvgFlag;
