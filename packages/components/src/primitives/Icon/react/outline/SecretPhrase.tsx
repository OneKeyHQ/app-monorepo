import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSecretPhrase = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 6v12h16V6zm18 12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    <Path d="M10 8a1 1 0 1 1 0 2H7a1 1 0 0 1 0-2zm7 0a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2zm-7 3a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm7 0a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2zm-7 3a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm7 0a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgSecretPhrase;
