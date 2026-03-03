import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23 22H1V8h22zM5 18h2v-2H5zm4 0h6v-2H9zm8 0h2v-2h-2zM5 12v2h2v-2zm4 0v2h2v-2zm4 2h2v-2h-2zm4-2v2h2v-2z"
      clipRule="evenodd"
    />
    <Path d="M15.414 5 14 6.414l-2-2-2 2L8.586 5 12 1.586z" />
  </Svg>
);
export default SvgKeyboardUp;
