import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCards = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 10v4a2 2 0 0 1-2 2H8v2h12v-8zM8 8a1 1 0 0 1 0 2H7a1 1 0 0 1 0-2zM4 6v8h12V6zm14 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCards;
