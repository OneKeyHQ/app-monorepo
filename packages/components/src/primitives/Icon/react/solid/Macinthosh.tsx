import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMacinthosh = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 16h-4v-2h4zm0-3H7V5h10z" />
    <Path
      fillRule="evenodd"
      d="M20 19h-1v3H5v-3H4V2h16zM6 4v13h12V4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMacinthosh;
