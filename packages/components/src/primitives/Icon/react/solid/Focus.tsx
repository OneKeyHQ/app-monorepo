import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFocus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.586 2.75a2 2 0 0 1 2.828 0l2.293 2.293a1 1 0 0 1-1.414 1.414L12 4.165 9.707 6.457a1 1 0 0 1-1.414-1.414zM6.457 8.293a1 1 0 0 1 0 1.414L4.164 12l2.293 2.293a1 1 0 0 1-1.414 1.415L2.75 13.415a2 2 0 0 1 0-2.829l2.293-2.293a1 1 0 0 1 1.414 0m11.086 0a1 1 0 0 1 1.414 0l2.293 2.293a2 2 0 0 1 0 2.829l-2.293 2.293a1 1 0 0 1-1.414-1.415L19.836 12l-2.293-2.293a1 1 0 0 1 0-1.414m-9.25 9.25a1 1 0 0 1 1.414 0L12 19.836l2.293-2.293a1 1 0 0 1 1.414 1.415l-2.293 2.292a2 2 0 0 1-2.828 0l-2.293-2.293a1 1 0 0 1 0-1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFocus;
