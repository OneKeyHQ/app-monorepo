import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMoney = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 6v12h18V6zm16 9a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zm-6-3a1 1 0 1 0-2 0 1 1 0 0 0 2 0M6 7a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2zm9 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0m8 6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgMoney;
