import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightBulb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 22H8v-2h8z" />
    <Path
      fillRule="evenodd"
      d="M12 1a8 8 0 0 1 4 14.928V19H8v-3.072A8 8 0 0 1 12 1m-2 16h4v-1h-4zm2-14a6 6 0 0 0-3.317 11h6.634A6 6 0 0 0 12 3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLightBulb;
