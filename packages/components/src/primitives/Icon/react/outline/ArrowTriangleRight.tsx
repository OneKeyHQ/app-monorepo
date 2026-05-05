import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.236 12 2.503 21.867 4.97 12 2.503 2.133zM6.78 11H10v2H6.78l-1.284 5.133L17.764 12 5.496 5.866z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTriangleRight;
