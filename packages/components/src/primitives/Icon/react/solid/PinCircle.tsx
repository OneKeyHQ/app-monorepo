import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPinCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.938 8.44A1.5 1.5 0 1 1 12.002 11h-.003a1.501 1.501 0 0 1-1.06-2.56Z" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m2.475 5.025A3.5 3.5 0 1 0 11 12.855V18h2v-5.146a3.5 3.5 0 0 0 1.475-5.83Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPinCircle;
