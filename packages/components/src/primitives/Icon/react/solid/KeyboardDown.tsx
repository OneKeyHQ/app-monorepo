import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.414 19 12 22.414 8.586 19 10 17.586l2 2 2-2z" />
    <Path
      fillRule="evenodd"
      d="M23 16H1V2h22zM5 12h2v-2H5zm4 0h6v-2H9zm8 0h2v-2h-2zM5 8h2V6H5zm4 0h2V6H9zm4 0h2V6h-2zm4 0h2V6h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardDown;
