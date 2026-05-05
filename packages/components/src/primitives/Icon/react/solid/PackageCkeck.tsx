import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageCkeck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 9h8V3h5v7.757l-4.5 4.5-1.75-1.75-4.242 4.243 3.25 3.25H3V3h5z" />
    <Path d="M21.914 15.5 16.5 20.914l-3.164-3.164 1.414-1.414 1.75 1.75 4-4zM14 7h-4V3h4z" />
  </Svg>
);
export default SvgPackageCkeck;
