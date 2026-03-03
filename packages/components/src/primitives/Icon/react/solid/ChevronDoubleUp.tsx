import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 11.586 17.414 17 16 18.414l-4-4-4 4L6.586 17zm0-7L17.414 10 16 11.414l-4-4-4 4L6.586 10z" />
  </Svg>
);
export default SvgChevronDoubleUp;
