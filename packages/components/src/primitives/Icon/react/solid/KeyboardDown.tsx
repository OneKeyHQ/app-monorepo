import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 5a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3zm9 5a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2zM4.75 7a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0m12 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M14 8.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5M8.75 7a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M6 12.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5M16.75 11a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m12 19.586-1.293-1.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l2-2a1 1 0 0 0-1.414-1.414z"
    />
  </Svg>
);
export default SvgKeyboardDown;
