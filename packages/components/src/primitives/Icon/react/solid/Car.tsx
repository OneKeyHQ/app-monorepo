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
      d="M4.892 4.824A2 2 0 0 1 6.509 4h10.972a2 2 0 0 1 1.636.85l3.402 4.836H23a1 1 0 1 1 0 2V18a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2H7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6.5a1 1 0 1 1 0-2h.49zM6 12a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2zm10 0a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCar;
