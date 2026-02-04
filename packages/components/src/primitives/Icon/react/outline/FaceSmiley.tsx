import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceSmiley = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-3.574.82a1 1 0 1 1 1.967.36 6.502 6.502 0 0 1-12.786 0 1 1 0 1 1 1.967-.36 4.502 4.502 0 0 0 8.852 0M9.5 7.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgFaceSmiley;
