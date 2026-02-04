import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTruck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 6v8h-.052c.293.287.537.625.715 1h2.674a3.5 3.5 0 0 1 6.326 0H20V6zm-2.5 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M4 15h.337A3.5 3.5 0 0 1 8 13.035V8H5.535L4 10.303zm18 0a2 2 0 0 1-2 2h-.036a3.5 3.5 0 0 1-6.928 0h-2.072a3.5 3.5 0 0 1-6.928 0H4a2 2 0 0 1-2-2v-4.697a2 2 0 0 1 .336-1.11L3.87 6.891A2 2 0 0 1 5.535 6H8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgTruck;
