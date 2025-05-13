import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThinkingBubble = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      d="M4.75 16.5a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5M13 2a4 4 0 0 0-3.262 1.684c-.152.214-.396.325-.57.319A5 5 0 0 0 6 13a4 4 0 0 0 6.683 2.966c.231-.21.575-.274.778-.209a5 5 0 0 0 5.882-2.28.37.37 0 0 1 .136-.135 5 5 0 0 0-2.647-9.34c-.174.006-.418-.105-.57-.319A4 4 0 0 0 13 2"
    />
  </Svg>
);
export default SvgThinkingBubble;
