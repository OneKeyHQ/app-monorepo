import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChatAnnotation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.002 5a2 2 0 0 0-2-2h-16a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2v2a1 1 0 0 0 1.515.858L12.279 19h7.723a2 2 0 0 0 2-2zM6.25 11a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0m4.5 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0m5.75 1.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatAnnotation;
