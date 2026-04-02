import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSecretPhrase = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM6 14v2h5v-2zm7 2h5v-2h-5zm-7-5v2h5v-2zm7 2h5v-2h-5zM6 8v2h5V8zm7 2h5V8h-5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSecretPhrase;
