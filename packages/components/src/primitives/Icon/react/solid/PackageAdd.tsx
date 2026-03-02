import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 9h8V3h5v8h-6v3h-3v7H3V3h5z" />
    <Path d="M19 13v3h3v2h-3v3h-2v-3h-3v-2h3v-3zm-5-6h-4V3h4z" />
  </Svg>
);
export default SvgPackageAdd;
