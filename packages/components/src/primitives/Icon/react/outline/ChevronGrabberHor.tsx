import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronGrabberHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m13.586 16 4-4-4-4L15 6.586 20.414 12 15 17.414zm-10-4L9 6.586 10.414 8l-4 4 4 4L9 17.414z" />
  </Svg>
);
export default SvgChevronGrabberHor;
