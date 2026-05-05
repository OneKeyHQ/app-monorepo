import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTopRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 16h-2V8.414L6.25 19.164 4.836 17.75 15.586 7H8V5h11z" />
  </Svg>
);
export default SvgArrowTopRight;
