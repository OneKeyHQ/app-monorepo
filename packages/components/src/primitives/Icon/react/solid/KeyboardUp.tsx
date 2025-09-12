import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12.707 2.293a1 1 0 0 0-1.414 0l-2 2a1 1 0 0 0 1.414 1.414L12 4.414l1.293 1.293a1 1 0 1 0 1.414-1.414z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 11a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3zm3.75 2a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M10 16a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2zm6.75-3a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M14 14.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5M8.75 13a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0M6 18.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5M16.75 17a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardUp;
