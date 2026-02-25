import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 21.236 3.382 4h17.236zm0-4.472L17.382 6H6.618z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTriangleBottom;
