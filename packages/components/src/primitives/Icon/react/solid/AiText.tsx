import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.245 12.755 23.736 15l-4.49 2.245L17 21.736l-2.245-4.49L10.264 15l4.49-2.245L17 8.264l2.245 4.49ZM8 17v2H3v-2zm2-4H3v-2h7zm11-6H3V5h18z" />
  </Svg>
);
export default SvgAiText;
