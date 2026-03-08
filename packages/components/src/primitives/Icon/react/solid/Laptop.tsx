import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLaptop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 15h2v6H1v-6h2V3h18zM3 19h18v-2H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLaptop;
