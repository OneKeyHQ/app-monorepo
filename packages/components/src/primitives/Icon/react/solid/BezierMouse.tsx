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
      d="M4.5 3A1.5 1.5 0 0 0 3 4.5v3A1.5 1.5 0 0 0 4.5 9H5v6h-.5A1.5 1.5 0 0 0 3 16.5v3A1.5 1.5 0 0 0 4.5 21h3A1.5 1.5 0 0 0 9 19.5V19h6v.5a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5v-3a1.5 1.5 0 0 0-1.5-1.5H19V9h.5A1.5 1.5 0 0 0 21 7.5v-3A1.5 1.5 0 0 0 19.5 3h-3A1.5 1.5 0 0 0 15 4.5V5H9v-.5A1.5 1.5 0 0 0 7.5 3zM7 15V9h.5A1.5 1.5 0 0 0 9 7.5V7h6v.5A1.5 1.5 0 0 0 16.5 9h.5v6h-.5a1.5 1.5 0 0 0-1.5 1.5v.5H9v-.5A1.5 1.5 0 0 0 7.5 15z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierMouse;
