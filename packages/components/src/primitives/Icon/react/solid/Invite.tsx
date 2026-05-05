import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInvite = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 9H9V7h6z" />
    <Path
      fillRule="evenodd"
      d="M20 2v8.28l2-.668V21H2V9.612l2 .667V2zM6 10.946l6 2 6-2V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgInvite;
