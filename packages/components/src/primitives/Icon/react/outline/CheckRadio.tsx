import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckRadio = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-5.774-3.133a1 1 0 0 1 1.548 1.266l-4.5 5.5a1 1 0 0 1-1.481.074l-2-2a1 1 0 1 1 1.414-1.414l1.218 1.218 3.8-4.644ZM22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgCheckRadio;
