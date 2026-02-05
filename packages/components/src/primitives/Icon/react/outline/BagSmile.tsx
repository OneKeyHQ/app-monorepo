import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBagSmile = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.06 3a2 2 0 0 1 1.997 1.875l.875 14A2 2 0 0 1 18.936 21H5.065a2 2 0 0 1-1.997-2.125l.875-14A2 2 0 0 1 5.94 3zM5.066 19h13.87l-.874-14H5.94zM8 8a1 1 0 0 1 2 0 2 2 0 0 0 4 0 1 1 0 0 1 2 0 4 4 0 0 1-8 0" />
  </Svg>
);
export default SvgBagSmile;
