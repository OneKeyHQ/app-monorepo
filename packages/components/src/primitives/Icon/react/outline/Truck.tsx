import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTruck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 17h-2.036a3.5 3.5 0 0 1-6.928 0h-2.072a3.5 3.5 0 0 1-6.928 0H2V9.697L4.465 6H8V4h14zM7.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M10 14h-.052c.293.287.537.625.715 1h2.674a3.5 3.5 0 0 1 6.326 0H20V6H10zm-6-3.697V15h.337A3.5 3.5 0 0 1 8 13.035V8H5.535z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTruck;
