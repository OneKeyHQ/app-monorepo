import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMacinthosh = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 16h-4v-2h4z" />
    <Path
      fillRule="evenodd"
      d="M17 13H7V5h10zm-8-2h6V7H9z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M20 19h-1v3H5v-3H4V2h16zM7 20h10v-1H7zm-1-3h12V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMacinthosh;
