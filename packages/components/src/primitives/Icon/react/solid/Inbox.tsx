import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInbox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2M5 5h14v7h-3.126a1 1 0 0 0-.969.75 3.002 3.002 0 0 1-5.81 0 1 1 0 0 0-.969-.75H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgInbox;
