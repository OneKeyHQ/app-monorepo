import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChat = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5.002 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 3v-3h-2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgChat;
