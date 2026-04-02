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
      d="m20 10.28 2-.668V21H2V9.612l2 .667V2h16zm-8 4.774-8-2.667V19h16v-6.613zm-6-4.108 6 2 6-2V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgInvite;
