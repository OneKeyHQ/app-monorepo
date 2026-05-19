import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEnergyCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m13.5 15-3-2.25L6 15l4.5-6 3 2.25L18 9z" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEnergyCircle;
