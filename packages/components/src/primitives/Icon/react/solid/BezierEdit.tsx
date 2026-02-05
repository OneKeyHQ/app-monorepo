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
      d="M19.126 14.874a.65.65 0 0 0-.919 0L15 18.08V19h.92l3.206-3.207a.65.65 0 0 0 0-.92Zm-2.333-1.414a2.65 2.65 0 1 1 3.747 3.747l-3.5 3.5a1 1 0 0 1-.707.293H14a1 1 0 0 1-1-1v-2.333a1 1 0 0 1 .293-.707z"
      clipRule="evenodd"
    />
    <Path d="M4.5 3A1.5 1.5 0 0 0 3 4.5v3A1.5 1.5 0 0 0 4.5 9H5v6h-.5A1.5 1.5 0 0 0 3 16.5v3A1.5 1.5 0 0 0 4.5 21h3A1.5 1.5 0 0 0 9 19.5V19h1a1 1 0 1 0 0-2H9v-.5A1.5 1.5 0 0 0 7.5 15H7V9h.5A1.5 1.5 0 0 0 9 7.5V7h6v.5A1.5 1.5 0 0 0 16.5 9h.5v1a1 1 0 1 0 2 0V9h.5A1.5 1.5 0 0 0 21 7.5v-3A1.5 1.5 0 0 0 19.5 3h-3A1.5 1.5 0 0 0 15 4.5V5H9v-.5A1.5 1.5 0 0 0 7.5 3z" />
  </Svg>
);
export default SvgBezierEdit;
