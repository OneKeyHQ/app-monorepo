import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageCheck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16.164 9.25-4.914 4.914-2.914-2.914L9.75 9.836l1.5 1.5 3.5-3.5z" />
    <Path
      fillRule="evenodd"
      d="M21.002 19.036h-5.627l-3.38 2.802-3.343-2.802h-5.65V3h18zm-16-2h4.377L12 19.233l2.377-1.967.278-.23h4.347V5h-14z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageCheck;
