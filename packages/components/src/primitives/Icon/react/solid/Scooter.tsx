import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgScooter = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m17.32 4 1.81 9.057a3.501 3.501 0 1 1-3.985 4.443h-6.29A3.502 3.502 0 0 1 2 16.5a3.5 3.5 0 0 1 6.855-1h6.29a3.51 3.51 0 0 1 1.99-2.224L15.682 6H13V4z" />
  </Svg>
);
export default SvgScooter;
