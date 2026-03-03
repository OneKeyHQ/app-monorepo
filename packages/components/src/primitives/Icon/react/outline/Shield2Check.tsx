import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShield2Check = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.414 10 11 15.414 7.586 12 9 10.586l2 2 4-4z" />
    <Path
      fillRule="evenodd"
      d="M12.4 1.584 21 5.346V13a9 9 0 1 1-18 0V5.346l8.6-3.762.4-.176zM5 6.654V13a7 7 0 1 0 14 0V6.653l-7-3.062-7 3.062Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShield2Check;
