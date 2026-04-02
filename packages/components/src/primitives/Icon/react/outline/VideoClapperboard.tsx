import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoClapperboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16v-7H4zm0-9h3.073l1.2-3H4zm11.727 0H20V6h-3.073zm-6.5 0h4.346l1.2-3h-4.346z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoClapperboard;
