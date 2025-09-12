import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVoiceSound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 4a1 1 0 0 0-2 0v16a1 1 0 1 0 2 0zm8 2a1 1 0 1 0-2 0v12a1 1 0 1 0 2 0zm-4 2a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0zm-8 2a1 1 0 0 0-2 0v4a1 1 0 1 0 2 0zm16 0a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0z"
    />
  </Svg>
);
export default SvgVoiceSound;
