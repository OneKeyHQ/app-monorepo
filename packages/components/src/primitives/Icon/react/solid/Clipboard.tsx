import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClipboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 2v2h4v18H4V4h4V2zm-6 4h4V4h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClipboard;
