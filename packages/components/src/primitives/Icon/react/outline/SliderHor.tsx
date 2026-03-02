import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSliderHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 13a4 4 0 0 1 3.874 3H21v2h-8.126a4 4 0 0 1-7.748 0H3v-2h2.126A4 4 0 0 1 9 13m0 2a2 2 0 1 0 0 4 2 2 0 1 0 0-4m6-12a4 4 0 0 1 3.874 3H21v2h-2.126a4 4 0 0 1-7.748 0H3V6h8.126A4 4 0 0 1 15 3m0 2a2 2 0 1 0 0 4 2 2 0 1 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSliderHor;
