import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSplit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 5H6.414L12 10.586 17.586 5H14V3h7v7h-2V6.414l-6 6V21h-2v-8.586l-6-6V10H3V3h7z" />
  </Svg>
);
export default SvgSplit;
