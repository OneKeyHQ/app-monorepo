import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.618 20H3.382L12 2.764zm-14-2h10.764L12 7.236z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTriangleTop;
