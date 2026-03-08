import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 20.618 2.764 12 20 3.382zM7.236 12 18 17.382V6.618z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTriangleLeft;
