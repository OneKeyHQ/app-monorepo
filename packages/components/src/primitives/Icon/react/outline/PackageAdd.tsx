import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v8h-2V5h-3v5H8V5H5v14h7v2H3V3zM10 8h4V5h-4z"
      clipRule="evenodd"
    />
    <Path d="M17 18h-3v-2h3v-3h2v3h3v2h-3v3h-2z" />
  </Svg>
);
export default SvgPackageAdd;
