import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStorage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.01 19H12v-2h2.01zm3 0H15v-2h2.01z" />
    <Path
      fillRule="evenodd"
      d="M20 22H4V2h16zM6 20h12v-4H6zm0-6h12V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStorage;
