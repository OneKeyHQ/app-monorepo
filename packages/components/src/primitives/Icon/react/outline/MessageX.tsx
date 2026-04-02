import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageX = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.414 9-2 2 2 2L14 14.414l-2-2-2 2L8.586 13l2-2-2-2L10 7.586l2 2 2-2z" />
    <Path
      fillRule="evenodd"
      d="M21.002 19.036h-5.627l-3.38 2.802-3.343-2.802h-5.65V3h18zm-16-2h4.377L12 19.233l2.377-1.967.278-.23h4.347V5h-14z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageX;
