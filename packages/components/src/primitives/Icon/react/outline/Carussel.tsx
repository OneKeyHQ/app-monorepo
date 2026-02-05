import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCarussel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 17V7a2 2 0 0 1 2-2h3a1 1 0 0 1 0 2H4v10h3a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2" />
    <Path d="M8 5v14h8V5zm10 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
    <Path d="M20 17V7h-3a1 1 0 1 1 0-2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgCarussel;
