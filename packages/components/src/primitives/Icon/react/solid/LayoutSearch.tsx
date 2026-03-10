import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.172 14.172a4 4 0 0 1 6.274 4.86L22.414 21 21 22.415l-1.968-1.968a4.002 4.002 0 0 1-4.86-6.275m4.242 1.414a2 2 0 1 0-2.828 2.83 2 2 0 0 0 2.828-2.83"
      clipRule="evenodd"
    />
    <Path d="M11 21H3v-8h8zm0-10H3V3h8zm10 0h-8V3h8z" />
  </Svg>
);
export default SvgLayoutSearch;
