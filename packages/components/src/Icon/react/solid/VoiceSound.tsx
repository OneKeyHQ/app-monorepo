import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVoiceSound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 4a1 1 0 0 0-2 0v16a1 1 0 1 0 2 0V4Zm8 2a1 1 0 1 0-2 0v12a1 1 0 1 0 2 0V6Zm-4 2a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0V8Zm-8 2a1 1 0 0 0-2 0v4a1 1 0 1 0 2 0v-4Zm16 0a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0v-4Z"
    />
  </Svg>
);
export default SvgVoiceSound;
