import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMoney = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23 20H1V4h22zm-5-2h3v-2h-3zm-6-8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M3 8h3V6H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMoney;
