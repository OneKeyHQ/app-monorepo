import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayerBehind = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V7h20zM4 18h16V9H4z"
      clipRule="evenodd"
    />
    <Path d="M20 5H4V3h16z" />
  </Svg>
);
export default SvgLayerBehind;
