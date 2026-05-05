import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVoiceSound = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 21H7V3h2zm8-2h-2V5h2zm-4-2h-2V7h2zm-8-2H3V9h2zm16 0h-2V9h2z" />
  </Svg>
);
export default SvgVoiceSound;
