import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPound = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0M9 9.5a3.5 3.5 0 0 1 5.945-2.504 1 1 0 1 1-1.397 1.43A1.5 1.5 0 0 0 11 9.5c0 .347.096.662.251.999.076.167.16.324.255.502H14a1 1 0 1 1 0 2h-2.134l-1.143 2H14a1 1 0 1 1 0 2H9a1 1 0 0 1-.868-1.496L9.562 13H9a1 1 0 1 1 0-2h.293A4.1 4.1 0 0 1 9 9.5M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgPound;
