import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 5h6V3h6v6h-2v2h-2V9h-2V7H9v2H7v6h2v2h2v2H9v2H3v-6h2V9H3V3h6zM5 19h2v-2H5zM5 7h2V5H5zm12 0h2V5h-2zm-.207 6.46a2.65 2.65 0 1 1 3.747 3.747L16.747 21H13v-3.747zm2.333 1.414a.65.65 0 0 0-.919 0L15 18.081V19h.919l3.207-3.207.084-.102a.65.65 0 0 0-.084-.817"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierEdit;
