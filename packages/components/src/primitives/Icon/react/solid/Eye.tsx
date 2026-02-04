import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 4.092c4.048 0 7.972 2.411 10.505 6.974a1.93 1.93 0 0 1 0 1.868c-2.533 4.563-6.457 6.974-10.505 6.974s-7.972-2.411-10.505-6.974a1.93 1.93 0 0 1 0-1.868C4.028 6.503 7.952 4.092 12 4.092M8.54 12a3.46 3.46 0 1 1 6.92 0 3.46 3.46 0 0 1-6.92 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEye;
