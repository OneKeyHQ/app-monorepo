import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCallIncoming = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.13 8.285 9.536 9.88a12.06 12.06 0 0 0 4.586 4.586l1.593-1.594L21 14.456V21h-1C10.611 21 3 13.389 3 4V3h6.544z" />
    <Path d="m21.414 4-4 4H20v2h-6V4h2v2.586l4-4z" />
  </Svg>
);
export default SvgCallIncoming;
