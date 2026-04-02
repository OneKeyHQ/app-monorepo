import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCallOutgoing = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.13 8.285 9.536 9.88a12.06 12.06 0 0 0 4.586 4.585l1.593-1.594L21 14.456V21h-1C10.611 21 3 13.389 3 4V3h6.544z" />
    <Path d="M21 9h-2V6.414l-4 4L13.586 9l4-4H15V3h6z" />
  </Svg>
);
export default SvgCallOutgoing;
