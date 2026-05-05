import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPrinter = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 12H6v-2h4z" />
    <Path
      fillRule="evenodd"
      d="M18 6h4v12h-4v4H6v-4H2V6h4V2h12zM8 20h8v-5H8zm-4-4h2v-3h12v3h2V8H4zM8 6h8V4H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPrinter;
