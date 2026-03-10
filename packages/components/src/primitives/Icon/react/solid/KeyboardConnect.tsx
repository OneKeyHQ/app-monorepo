import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardConnect = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19 2v4H7v2h16v14H1V8h4V4h12V2zM5 16v2h2v-2zm4 0v2h6v-2zm8 0v2h2v-2zM5 14h2v-2H5zm4 0h2v-2H9zm4-2v2h2v-2zm4 2h2v-2h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardConnect;
