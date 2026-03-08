import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPrinter = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 2v4h4v12h-4v4H6v-4H2V6h4V2zM8 20h8v-5H8zM6.5 10v2h4v-2zM8 6h8V4H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPrinter;
