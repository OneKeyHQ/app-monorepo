import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChat = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.002 19h-9.723l-6.277 3.767V19h-4V3h20zm-18-2h4v2.233L11.725 17h8.277V5h-16z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChat;
