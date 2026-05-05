import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 5H5v14h14v-5h2v7H3V3h7z" />
    <Path d="M21 11h-2V6.414l-8 8L9.586 13l8-8H13V3h8z" />
  </Svg>
);
export default SvgOpen;
