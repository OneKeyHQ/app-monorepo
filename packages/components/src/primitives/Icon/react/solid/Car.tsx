import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.868 9H23v2h-1v9h-5v-2H7v2H2v-9H1V9h2.132l3.333-5h11.07zM5 12v2h3v-2zm11 0v2h3v-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCar;
