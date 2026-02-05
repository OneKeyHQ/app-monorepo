import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.293 18.293a1 1 0 1 1 1.414 1.414l-2 2a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L12 19.586zM6 9.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m12 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5M14 10a1 1 0 1 1 0 2h-4a1 1 0 1 1 0-2zM6 5.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M21 2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM3 14h18V4H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardDown;
