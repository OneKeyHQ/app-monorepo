import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShoppingBagAdd2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 18h3v2h-3v3h-2v-3h-3v-2h3v-3h2z" />
    <Path
      fillRule="evenodd"
      d="M12 2a4 4 0 0 1 4 4v1h2.358l.88 5.719-1.977.304L16.643 9H7.357L5.666 20H12v2H3.334L5.642 7H8V6a4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShoppingBagAdd2;
