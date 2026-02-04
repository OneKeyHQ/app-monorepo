import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.13 1.71c-.455-.947-1.805-.947-2.26 0L8.365 6.938l-5.774.757c-1.038.136-1.47 1.42-.697 2.15l4.22 3.985-1.06 5.69c-.194 1.047.912 1.824 1.828 1.33L12 18.085l5.119 2.764c.915.494 2.022-.283 1.827-1.33l-1.06-5.69 4.22-3.985c.773-.73.342-2.014-.697-2.15l-5.773-.757z" />
  </Svg>
);
export default SvgStar;
