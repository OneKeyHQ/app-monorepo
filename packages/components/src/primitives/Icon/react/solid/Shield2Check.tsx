import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShield2Check = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 5.346V13a9 9 0 0 1-18 0V5.346l9-3.938zm-10 7.24-2-2L7.586 12 11 15.414 16.414 10 15 8.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShield2Check;
