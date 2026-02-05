import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTelevision = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 17.75c2.21 0 4.336.37 6.325 1.055a1 1 0 1 1-.65 1.89A17.4 17.4 0 0 0 12 19.75c-1.984 0-3.892.332-5.675.945a1 1 0 1 1-.65-1.89A19.4 19.4 0 0 1 12 17.75m-8-13v10h16v-10zm18 10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgTelevision;
