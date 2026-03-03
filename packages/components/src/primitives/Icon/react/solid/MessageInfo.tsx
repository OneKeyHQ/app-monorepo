import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageInfo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.002 3v16.036h-5.626l-3.382 2.802-3.343-2.802H3.002V3zM11 10v5h2v-5zm0-1h2V7h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageInfo;
