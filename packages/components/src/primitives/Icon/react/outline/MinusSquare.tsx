import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMinusSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 11v2H8v-2z" />
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMinusSquare;
