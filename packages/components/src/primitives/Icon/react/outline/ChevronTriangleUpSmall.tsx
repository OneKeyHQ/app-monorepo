import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTriangleUpSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17 14H7l5-6.667zm-6.001-2h2.002L12 10.666z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronTriangleUpSmall;
