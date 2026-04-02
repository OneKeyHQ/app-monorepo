import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFile1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2v8h8v12H4V2z" />
    <Path d="M19.414 8H14V2.586z" />
  </Svg>
);
export default SvgFile1;
