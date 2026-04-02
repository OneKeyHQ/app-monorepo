import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 14H5v-2h3zm11 0h-3v-2h3z" />
    <Path
      fillRule="evenodd"
      d="M20.868 9H23v2h-1v9h-6v-2H8v2H2v-9H1V9h2.132l3.333-5h11.07zM4 11.303V18h2v-2h12v2h2v-6.697L16.465 6h-8.93z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCar;
