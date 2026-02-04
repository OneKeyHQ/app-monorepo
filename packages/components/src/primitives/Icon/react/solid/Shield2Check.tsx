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
      d="M11.198 1.963a2 2 0 0 1 1.604 0l7 3.063A2 2 0 0 1 21 6.858v6.346a9 9 0 1 1-18 0V6.858a2 2 0 0 1 1.198-1.832zm4.51 8.948a1 1 0 0 0-1.415-1.414L11 12.79l-1.293-1.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShield2Check;
