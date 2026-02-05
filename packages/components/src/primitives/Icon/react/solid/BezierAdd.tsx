import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 9a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1h-1a1 1 0 1 1 0-2h1v-1a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M3 4.5A1.5 1.5 0 0 1 4.5 3h3A1.5 1.5 0 0 1 9 4.5V5h6v-.5A1.5 1.5 0 0 1 16.5 3h3A1.5 1.5 0 0 1 21 4.5v3A1.5 1.5 0 0 1 19.5 9H19v6h.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5V19H9v.5A1.5 1.5 0 0 1 7.5 21h-3A1.5 1.5 0 0 1 3 19.5v-3A1.5 1.5 0 0 1 4.5 15H5V9h-.5A1.5 1.5 0 0 1 3 7.5zM7 9v6h.5A1.5 1.5 0 0 1 9 16.5v.5h6v-.5a1.5 1.5 0 0 1 1.5-1.5h.5V9h-.5A1.5 1.5 0 0 1 15 7.5V7H9v.5A1.5 1.5 0 0 1 7.5 9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierAdd;
