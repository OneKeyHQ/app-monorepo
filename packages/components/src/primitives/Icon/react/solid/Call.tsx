import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m9.544 3 1.586 5.285L9.536 9.88a12.06 12.06 0 0 0 4.586 4.585l1.593-1.594L21 14.456V21h-1C10.611 21 3 13.389 3 4V3z" />
  </Svg>
);
export default SvgCall;
