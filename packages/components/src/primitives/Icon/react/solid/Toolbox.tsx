import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgToolbox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.923 2.75A2 2 0 0 1 7.485 2h.038a2 2 0 0 1 1.562.75l1.48 1.851a2 2 0 0 1 .439 1.25V10H12V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a1 1 0 0 1 1-1h1.004V5.85a2 2 0 0 1 .438-1.249l1.48-1.85Zm.08 7.25h3V5.85L7.524 4h-.038L6.004 5.85zM18 10V4h-4v2h1.004a1 1 0 1 1 0 2H14v2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgToolbox;
