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
      d="M7.5 9.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1m4.5-.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1m4.5-.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0 .75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M22.002 19h-9.723l-6.277 3.767V19h-4V3h20zm-18-2h4v2.233L11.725 17h8.277V5h-16z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatAnnotation;
