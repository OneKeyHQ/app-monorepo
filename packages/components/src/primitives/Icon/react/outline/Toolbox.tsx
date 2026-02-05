import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgToolbox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12H4v7h16zM7.523 4h-.039l-1.48 1.85V10h3V5.85L7.524 4ZM14 4v2h1.004a1 1 0 1 1 0 2H14v2h4V4zm6 6h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a1 1 0 0 1 1-1h1.004V5.85a2 2 0 0 1 .438-1.248l1.48-1.851A2 2 0 0 1 7.485 2h.04a2 2 0 0 1 1.561.751l1.48 1.85a2 2 0 0 1 .439 1.25V10H12V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgToolbox;
