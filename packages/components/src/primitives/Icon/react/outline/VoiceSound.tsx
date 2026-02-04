import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVoiceSound = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 20V4a1 1 0 0 1 2 0v16a1 1 0 1 1-2 0m8-2V6a1 1 0 1 1 2 0v12a1 1 0 1 1-2 0m-4-2V8a1 1 0 1 1 2 0v8a1 1 0 1 1-2 0m-8-2v-4a1 1 0 0 1 2 0v4a1 1 0 1 1-2 0m16 0v-4a1 1 0 1 1 2 0v4a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgVoiceSound;
