import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrossedSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m17.414 8-4 4 4 4L16 17.414l-4-4-4 4L6.586 16l4-4-4-4L8 6.586l4 4 4-4z" />
  </Svg>
);
export default SvgCrossedSmall;
