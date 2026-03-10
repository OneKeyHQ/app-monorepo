import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageExclamation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 15h-2v-2h2zm0-3h-2V7h2z" />
    <Path
      fillRule="evenodd"
      d="M21.002 19.036h-5.627l-3.38 2.802-3.343-2.802h-5.65V3h18zm-16-2h4.377L12 19.233l2.377-1.967.278-.23h4.347V5h-14z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageExclamation;
