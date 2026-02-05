import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCourt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.597 2.138a2 2 0 0 0-1.194 0L4.228 4.38A1.75 1.75 0 0 0 3 6.05v2.2C3 9.215 3.784 10 4.75 10H5v7a1 1 0 1 0 2 0v-7h2v7a1 1 0 1 0 2 0v-7h2v7a1 1 0 1 0 2 0v-7h2v7a1 1 0 1 0 2 0v-7h.25A1.75 1.75 0 0 0 21 8.25v-2.2a1.75 1.75 0 0 0-1.228-1.67zM3 20a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1" />
  </Svg>
);
export default SvgCourt;
