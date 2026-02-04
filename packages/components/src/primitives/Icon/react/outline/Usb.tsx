import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUsb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 11H5v9h14zM7 9h10V4H7zm2-2V6a1 1 0 0 1 2 0v1a1 1 0 1 1-2 0m4 0V6a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0m8 13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a1 1 0 0 1 1-1h1V3l.005-.103A1 1 0 0 1 6 2h12a1 1 0 0 1 1 1v6h1a1 1 0 0 1 1 1z" />
  </Svg>
);
export default SvgUsb;
