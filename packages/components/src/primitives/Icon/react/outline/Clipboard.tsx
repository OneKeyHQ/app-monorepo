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
      d="M16 4h4v18H4V4h4V2h8zM6 20h12V6h-2v2H8V6H6zm4-14h4V4h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClipboard;
