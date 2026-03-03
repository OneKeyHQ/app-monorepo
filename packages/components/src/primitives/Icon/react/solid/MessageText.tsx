import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.002 3v16.036h-5.626l-3.382 2.802-3.343-2.802H3.002V3zM8 14h8v-2H8zm0-6v2h8V8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageText;
