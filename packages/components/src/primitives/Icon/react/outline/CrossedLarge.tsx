import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrossedLarge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m20.414 5-7 7 7 7L19 20.414l-7-7-7 7L3.586 19l7-7-7-7L5 3.586l7 7 7-7z" />
  </Svg>
);
export default SvgCrossedLarge;
