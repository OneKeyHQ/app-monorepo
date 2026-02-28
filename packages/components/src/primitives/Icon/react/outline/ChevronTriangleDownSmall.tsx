import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTriangleDownSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 16.667 7 10h10zm0-3.333L13.001 12h-2.002z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronTriangleDownSmall;
