import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVoiceSound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M8 4v16M4 10v4m8-6v8m4-10v12m4-8v4"
    />
  </Svg>
);
export default SvgVoiceSound;
