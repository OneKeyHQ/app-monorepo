import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCryptopunk = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 13h2v9H5v-7H3v-5h2zm12 7h-5v2h-2v-4h7zM7 6h10V4h2v2h3v2h-3v10h-2V8H7v2H5V4h2z" />
    <Path d="M11.01 14H15v2h-4v-1H9v-2h2.01zm1-3H10V9h2.01zm4 0H14V9h2.01zM17 4H7V2h10z" />
  </Svg>
);
export default SvgCryptopunk;
