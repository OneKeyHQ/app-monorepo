import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSliderHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 13a4 4 0 0 1 3.874 3H20a1 1 0 1 1 0 2h-7.126a4 4 0 0 1-7.748 0H4a1 1 0 1 1 0-2h1.126A4 4 0 0 1 9 13m0 2a2 2 0 1 0 0 4 2 2 0 1 0 0-4m10-8a2 2 0 1 0-4 0 2 2 0 1 0 4 0m2 0a4 4 0 0 1-7.874 1H4a1 1 0 0 1 0-2h9.126A4 4 0 0 1 21 7" />
  </Svg>
);
export default SvgSliderHor;
