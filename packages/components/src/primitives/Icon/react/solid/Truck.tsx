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
      d="M22 4v13h-2.035a3.501 3.501 0 0 1-6.93 0h-2.07a3.501 3.501 0 0 1-6.93 0H2V9.697L4.465 6H8V4zM7.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M4 10.303V15h.337A3.5 3.5 0 0 1 8 13.035V8H5.535z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTruck;
