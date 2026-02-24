import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSecretPhrase = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 16H6v-2h5zm7 0h-5v-2h5zm-7-3H6v-2h5zm7 0h-5v-2h5zm-7-3H6V8h5zm7 0h-5V8h5z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSecretPhrase;
