import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMoney = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 17h-3v-2h3z" />
    <Path
      fillRule="evenodd"
      d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
    <Path d="M7 9H4V7h3z" />
    <Path
      fillRule="evenodd"
      d="M23 20H1V4h22zM3 18h18V6H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMoney;
