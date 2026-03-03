import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 12.414 6.586 7 8 5.586l4 4 4-4L17.414 7zm0 7L6.586 14 8 12.586l4 4 4-4L17.414 14z" />
  </Svg>
);
export default SvgChevronDoubleDown;
