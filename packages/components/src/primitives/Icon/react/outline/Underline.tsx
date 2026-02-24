import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUnderline = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 22H5v-2h14zM7 12a5 5 0 0 0 10 0V3h2v9a7 7 0 1 1-14 0V3h2z" />
  </Svg>
);
export default SvgUnderline;
