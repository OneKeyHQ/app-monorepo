import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwitchVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17 3a1 1 0 0 1 1 1v13.836l2.293-2.293a1 1 0 0 1 1.414 1.414l-3.47 3.47a1.75 1.75 0 0 1-2.474 0l-3.47-3.47a1 1 0 0 1 1.414-1.414L16 17.836V4a1 1 0 0 1 1-1M8 6.164l2.293 2.293a1 1 0 1 0 1.414-1.414l-3.47-3.47a1.75 1.75 0 0 0-2.474 0l-3.47 3.47a1 1 0 0 0 1.414 1.414L6 6.164V20a1 1 0 1 0 2 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSwitchVer;
