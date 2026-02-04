import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChatGroup = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.002 3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2h-5.24l-4.274 2.374a1 1 0 0 1-1.486-.874V19h-1a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2zm-12 4h8a2 2 0 0 1 2 2v4h2V5h-12z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatGroup;
