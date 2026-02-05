import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTelevision = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 4.75a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm4.326 15.945A17.4 17.4 0 0 1 12 19.75c1.985 0 3.892.332 5.675.945a1 1 0 1 0 .65-1.89A19.4 19.4 0 0 0 12 17.75c-2.209 0-4.336.37-6.325 1.054a1 1 0 1 0 .65 1.892Z" />
  </Svg>
);
export default SvgTelevision;
