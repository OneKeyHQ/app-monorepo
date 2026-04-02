import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierMouse = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 5h6V3h6v6h-2v6h2v6h-6v-2H9v2H3v-6h2V9H3V3h6zM5 19h2v-2H5zm12 0h2v-2h-2zM9 9H7v6h2v2h6v-2h2V9h-2V7H9zM5 7h2V5H5zm12 0h2V5h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierMouse;
