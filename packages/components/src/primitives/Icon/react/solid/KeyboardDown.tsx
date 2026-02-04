import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M1 4a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2zm9 6a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2zM4.75 7a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0m12 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M14 8.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5M8.75 7a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M6 12.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5M16.75 11a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0"
      clipRule="evenodd"
    />
    <Path d="m12 19.586-1.293-1.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l2-2a1 1 0 0 0-1.414-1.414z" />
  </Svg>
);
export default SvgKeyboardDown;
