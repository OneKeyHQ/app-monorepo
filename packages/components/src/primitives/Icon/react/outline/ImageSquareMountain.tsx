import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImageSquareMountain = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 15.354c-1.112.697-2.385 1.1-4 1.1-2.81 0-4.796-1.755-6.313-3.389a1 1 0 0 0-1.272-.16L5 14.71V19h14zM16 9a1 1 0 1 0-2 0 1 1 0 0 0 2 0M5 5v7.213l1.246-.932.044-.031a3 3 0 0 1 3.862.455c1.469 1.581 2.942 2.75 4.848 2.75 1.704 0 2.854-.558 4-1.621V5zm13 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0m3 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgImageSquareMountain;
