import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKingVipCrown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.342 8.71 23.4 5.182 20.314 20H3.687L.6 5.182 7.657 8.71 12 2.197zm-8 2.58L3.4 8.816 5.312 18h13.375L20.6 8.817l-4.943 2.472L12 5.803z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKingVipCrown;
